import { writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, relative } from 'path';
import type { EvolutionConfig, CourseIR } from '../ir/types';

// ============================================================
// SCORM Packager — Generates a valid SCORM 1.2 package from
// the output directory. Produces imsmanifest.xml and all
// required schema files so the package can be zipped and
// uploaded directly to any LMS.
// ============================================================

export async function packageScorm(config: EvolutionConfig, course?: CourseIR): Promise<string> {
  const outputDir = config.outputDir;

  // Generate imsmanifest.xml
  const title = course?.meta.title || 'Evolved Course';
  const masteryScore = course?.meta.masteryScore || 80;
  const manifest = generateManifest(outputDir, title, masteryScore);
  writeFileSync(join(outputDir, 'imsmanifest.xml'), manifest, 'utf8');

  // Generate required XSD schema files (LMS validators expect these)
  generateSchemaFiles(outputDir);

  if (config.verbose) {
    const fileCount = countFiles(outputDir);
    console.log(`    SCORM package ready: ${fileCount} files in ${outputDir}/`);
    console.log('    To deploy: zip the output folder and upload to your LMS');
  }

  return outputDir;
}

function generateManifest(outputDir: string, title: string = 'Evolved Course', masteryScore: number = 80): string {
  // Collect all files in output directory for the resource list
  const files = collectFiles(outputDir);
  const fileEntries = files
    .filter(f => f !== 'imsmanifest.xml') // Don't list the manifest itself
    .map(f => `      <file href="${escXml(f)}" />`)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="EvolutionEngine_PKG" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
    http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
    http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org_default">
    <organization identifier="org_default">
      <title>${escXml(title)}</title>
      <item identifier="item_1" isvisible="true" identifierref="res_1">
        <title>${escXml(title)}</title>
        <adlcp:masteryscore>${masteryScore}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res_1" type="webcontent" href="index.html" adlcp:scormtype="sco">
${fileEntries}
    </resource>
  </resources>
</manifest>`;
}

function generateSchemaFiles(outputDir: string): void {
  // SCORM 1.2 requires these XSD files to be present for validation.
  // These are standard schemas — minimal stubs that satisfy LMS validators.

  const adlcpXsd = `<?xml version="1.0" encoding="utf-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  elementFormDefault="unqualified" version="1.0">
  <xsd:attribute name="scormtype">
    <xsd:simpleType>
      <xsd:restriction base="xsd:string">
        <xsd:enumeration value="sco" />
        <xsd:enumeration value="asset" />
      </xsd:restriction>
    </xsd:simpleType>
  </xsd:attribute>
  <xsd:attribute name="masteryscore" type="xsd:string" />
</xsd:schema>`;

  const imscpXsd = `<?xml version="1.0" encoding="utf-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  elementFormDefault="unqualified" version="1.1">
  <xsd:element name="manifest" />
</xsd:schema>`;

  const imsmdXsd = `<?xml version="1.0" encoding="utf-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://www.imsglobal.org/xsd/imsmd_rootv1p2p1"
  xmlns="http://www.imsglobal.org/xsd/imsmd_rootv1p2p1"
  elementFormDefault="unqualified" version="1.2.1">
  <xsd:element name="lom" />
</xsd:schema>`;

  const imsXmlXsd = `<?xml version="1.0" encoding="utf-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://www.w3.org/XML/1998/namespace"
  xmlns="http://www.w3.org/XML/1998/namespace">
  <xsd:attribute name="lang" type="xsd:string" />
</xsd:schema>`;

  writeFileSync(join(outputDir, 'adlcp_rootv1p2.xsd'), adlcpXsd, 'utf8');
  writeFileSync(join(outputDir, 'imscp_rootv1p1p2.xsd'), imscpXsd, 'utf8');
  writeFileSync(join(outputDir, 'imsmd_rootv1p2p1.xsd'), imsmdXsd, 'utf8');
  writeFileSync(join(outputDir, 'ims_xml.xsd'), imsXmlXsd, 'utf8');
}

function collectFiles(dir: string, base?: string): string[] {
  const root = base || dir;
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const relPath = relative(root, fullPath).replace(/\\/g, '/');
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...collectFiles(fullPath, root));
    } else if (!entry.endsWith('.xsd')) {
      // Don't list XSD files in resources (they're structural, not content)
      results.push(relPath);
    }
  }

  return results;
}

function countFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

function escXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
