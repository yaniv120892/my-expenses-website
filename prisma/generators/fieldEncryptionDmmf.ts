import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generatorHandler } from '@prisma/generator-helper';

// The generated client's datamodel drops the `///` documentation and the
// id/unique/list flags prisma-field-encryption reads `@encrypted` from, so this
// writes them out from the full DMMF only a generator is handed.
generatorHandler({
  onManifest: () => ({ prettyName: 'Field encryption DMMF' }),
  onGenerate: async ({ dmmf, generator }) => {
    const outputDirectory = generator.output?.value;
    if (!outputDirectory) {
      throw new Error(
        `generator ${generator.name} needs an output directory in schema.prisma`,
      );
    }
    const models = dmmf.datamodel.models.map((model) => ({
      name: model.name,
      fields: model.fields.map((field) => ({
        name: field.name,
        type: field.type,
        isList: field.isList,
        isUnique: field.isUnique,
        isId: field.isId,
        documentation: field.documentation,
      })),
    }));
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(
      path.join(outputDirectory, 'dmmf.json'),
      `${JSON.stringify({ datamodel: { models } }, null, 2)}\n`,
    );
  },
});
