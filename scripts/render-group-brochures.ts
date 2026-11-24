import fs from "node:fs/promises";
import path from "node:path";
import { getFullPackage } from "../src/data/packageDetails";
import { renderPackageBrochurePdf } from "../src/lib/documents/packageBrochurePdf";

// These local images belong to the selected destinations. Preview generation
// never depends on a third-party photo host or changes the published catalogue.
const previews = [
  {
    id: "sikkim-darjeeling-6n",
    file: "bandhan-group-sikkim-darjeeling.pdf",
    hero: "/pdf-assets/kanchenjunga-darjeeling.jpg",
    gallery: [
      { image: "/pdf-assets/tsomgo-lake.jpg", caption: "Tsomgo Lake, Sikkim" },
      { image: "/pdf-assets/darjeeling-railway.jpg", caption: "Darjeeling Himalayan Railway" },
    ],
  },
  {
    id: "singapore-malaysia-thailand",
    file: "bandhan-group-singapore-malaysia-thailand.pdf",
    hero: "/pdf-assets/singapore-marina-bay.jpg",
    gallery: [
      { image: "/pdf-assets/singapore-marina-bay.jpg", caption: "Marina Bay, Singapore" },
      { image: "/pdf-assets/kuala-lumpur-skyline.jpg", caption: "Kuala Lumpur, Malaysia" },
      { image: "/pdf-assets/bangkok-chinatown.jpg", caption: "Bangkok, Thailand" },
    ],
  },
];

async function main() {
  const directory = path.join(process.cwd(), "output", "pdf");
  await fs.mkdir(directory, { recursive: true });
  for (const preview of previews) {
    const pkg = getFullPackage(preview.id);
    if (!pkg) throw new Error(`Missing preview package: ${preview.id}`);
    pkg.heroImage = preview.hero;
    pkg.gallery = preview.gallery;
    const pdf = await renderPackageBrochurePdf(pkg);
    await fs.writeFile(path.join(directory, preview.file), pdf);
    console.log(`${preview.file}: ${pdf.byteLength} bytes`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
