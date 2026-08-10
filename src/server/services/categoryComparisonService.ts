import { TransactionType } from '@prisma/client';
import {
  CategoryComparison,
  ComparisonBucket,
  ComparisonCell,
  ComparisonScope,
  ComparisonSeries,
  GetCategoryComparisonRequest,
} from '@/shared/types/trends';
import categoryRepository from '@/server/repositories/categoryRepository';
import transactionRepository from '@/server/repositories/transactionRepository';
import { buildCategoryDescendantMap } from '@/server/utils/categoryHierarchy';
import { bucketKeyFor, enumerateBuckets } from '@/server/utils/periodBuckets';
import { HttpError } from '@/server/http/errors';
import logger from '@/server/logging/logger';

function emptyCell(): ComparisonCell {
  return { income: 0, expense: 0, net: 0, count: 0 };
}

function addToCell(
  cell: ComparisonCell,
  type: TransactionType,
  amount: number,
  count: number,
): void {
  if (type === TransactionType.INCOME) {
    cell.income += amount;
  } else {
    cell.expense += amount;
  }
  cell.net = cell.income - cell.expense;
  cell.count += count;
}

class CategoryComparisonService {
  public async getCategoryComparison(
    request: GetCategoryComparisonRequest,
    userId: string,
  ): Promise<CategoryComparison> {
    const [allCategories, descendantMap] = await Promise.all([
      categoryRepository.getAllCategories(),
      buildCategoryDescendantMap(),
    ]);

    const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
    const seriesDefinitions = request.categoryIds.map((categoryId) => {
      const category = categoriesById.get(categoryId);
      if (!category) {
        throw new HttpError(404, `Unknown category: ${categoryId}`);
      }
      const memberCategoryIds =
        request.scope === 'SUBTREE'
          ? (descendantMap.get(categoryId) ?? [categoryId])
          : [categoryId];
      return { category, memberCategoryIds };
    });

    // One id can belong to several series (a parent and its child were both
    // selected), so the lookup maps an id to every series that wants it.
    const seriesIndexesByCategoryId = new Map<string, number[]>();
    seriesDefinitions.forEach((definition, seriesIndex) => {
      for (const memberId of definition.memberCategoryIds) {
        const indexes = seriesIndexesByCategoryId.get(memberId) ?? [];
        indexes.push(seriesIndex);
        seriesIndexesByCategoryId.set(memberId, indexes);
      }
    });

    const rows = await transactionRepository.getCategoryPeriodTotals({
      userId,
      startDate: request.startDate,
      endDate: request.endDate,
      categoryIds: Array.from(seriesIndexesByCategoryId.keys()),
      transactionType: request.transactionType,
    });

    const buckets = this.buildBuckets(
      rows,
      seriesIndexesByCategoryId,
      seriesDefinitions.length,
      request,
    );
    const series = this.buildSeries(seriesDefinitions, buckets, request.scope);
    const grandTotal = this.sumCells(buckets.map((bucket) => bucket.rowTotal));

    logger.debug(
      { userId, seriesCount: series.length, bucketCount: buckets.length },
      'Category comparison computed',
    );

    return {
      period: request.period,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
      series,
      buckets,
      grandTotal,
      hasOverlappingSeries: Array.from(seriesIndexesByCategoryId.values()).some(
        (indexes) => indexes.length > 1,
      ),
    };
  }

  private buildBuckets(
    rows: {
      categoryId: string;
      type: TransactionType;
      date: Date;
      sum: number;
      count: number;
    }[],
    seriesIndexesByCategoryId: Map<string, number[]>,
    seriesCount: number,
    request: GetCategoryComparisonRequest,
  ): ComparisonBucket[] {
    const buckets = enumerateBuckets(
      request.startDate,
      request.endDate,
      request.period,
    ).map((bucket) => ({
      key: bucket.key,
      startDate: bucket.startDate.toISOString(),
      cells: Array.from({ length: seriesCount }, emptyCell),
      rowTotal: emptyCell(),
    }));

    const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    for (const row of rows) {
      const bucket = bucketsByKey.get(bucketKeyFor(row.date, request.period));
      if (!bucket) {
        // The range is derived from the same dates, so this only fires if a
        // row escapes the enumerated interval.
        logger.warn(
          { categoryId: row.categoryId, date: row.date },
          'Comparison row fell outside the enumerated period range',
        );
        continue;
      }

      const seriesIndexes = seriesIndexesByCategoryId.get(row.categoryId) ?? [];
      for (const seriesIndex of seriesIndexes) {
        addToCell(bucket.cells[seriesIndex], row.type, row.sum, row.count);
      }
      // Counted once per row, so an overlapping selection does not inflate the
      // row total beyond the transactions that actually exist.
      addToCell(bucket.rowTotal, row.type, row.sum, row.count);
    }

    return buckets;
  }

  private buildSeries(
    seriesDefinitions: {
      category: { id: string; name: string };
      memberCategoryIds: string[];
    }[],
    buckets: ComparisonBucket[],
    scope: ComparisonScope,
  ): ComparisonSeries[] {
    return seriesDefinitions.map((definition, seriesIndex) => ({
      categoryId: definition.category.id,
      categoryName: definition.category.name,
      scope,
      memberCategoryIds: definition.memberCategoryIds,
      total: this.sumCells(buckets.map((bucket) => bucket.cells[seriesIndex])),
    }));
  }

  private sumCells(cells: ComparisonCell[]): ComparisonCell {
    return cells.reduce((total, cell) => {
      total.income += cell.income;
      total.expense += cell.expense;
      total.net = total.income - total.expense;
      total.count += cell.count;
      return total;
    }, emptyCell());
  }
}

export default new CategoryComparisonService();
