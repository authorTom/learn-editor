import type { Course } from '../types'
import { escapeHtml } from '../utils/file'

/**
 * `<file>` entries for everything in the package besides index.html.
 *
 * A resource has to declare every file it depends on. Some LMSs use the listing
 * to decide what to actually deploy, so media missing from it can be dropped on
 * import and leave a course full of broken images that worked fine locally.
 */
function fileEntries(paths: string[]): string {
  return paths.map((p) => `\n      <file href="${escapeHtml(p)}"/>`).join('')
}

/** Passing score of the first quiz found, if any — used for masteryscore. */
function firstPassingScore(course: Course): number | null {
  for (const l of course.lessons) {
    for (const b of l.blocks) {
      if (b.type === 'quiz') return b.passingScore
    }
  }
  return null
}

export function buildManifest12(course: Course, mediaPaths: string[] = []): string {
  const title = escapeHtml(course.title)
  const mastery = firstPassingScore(course)
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.learneditor.${course.id}" version="1.2"
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
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${title}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${title}</title>${
          mastery !== null ? `\n        <adlcp:masteryscore>${mastery}</adlcp:masteryscore>` : ''
        }
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>${fileEntries(mediaPaths)}
    </resource>
  </resources>
</manifest>`
}

export function buildManifest2004(course: Course, mediaPaths: string[] = []): string {
  const title = escapeHtml(course.title)
  const mastery = firstPassingScore(course)
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.learneditor.${course.id}" version="1"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                      http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
                      http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
                      http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
                      http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${title}</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>${title}</title>${
          mastery !== null
            ? `\n        <imsss:sequencing>
          <imsss:objectives>
            <imsss:primaryObjective objectiveID="PRIMARY" satisfiedByMeasure="true">
              <imsss:minNormalizedMeasure>${(mastery / 100).toFixed(2)}</imsss:minNormalizedMeasure>
            </imsss:primaryObjective>
          </imsss:objectives>
        </imsss:sequencing>`
            : ''
        }
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>${fileEntries(mediaPaths)}
    </resource>
  </resources>
</manifest>`
}
