/**
 * The WCAG 2.2 Level A and AA success criteria, as the conformance report needs
 * them.
 *
 * The list is the *whole* of A and AA, not just the ones this tool can test.
 * A conformance report that silently omits the criteria nobody checked is worse
 * than useless — the reader cannot tell "we verified this" from "we forgot".
 * Criteria with no automatable rule are reported honestly as needing a manual
 * determination, which is what an evaluator has to do anyway.
 */

export type Level = 'A' | 'AA'

export interface Criterion {
  /** e.g. '1.1.1' */
  num: string
  name: string
  level: Level
  /** Short statement of what an author has to do, for the report's remarks. */
  intent: string
}

export const CRITERIA: Criterion[] = [
  { num: '1.1.1', name: 'Non-text Content', level: 'A', intent: 'Images, icons and media convey their meaning in text as well.' },
  { num: '1.2.1', name: 'Audio-only and Video-only (Prerecorded)', level: 'A', intent: 'Audio-only and video-only media have an equivalent alternative.' },
  { num: '1.2.2', name: 'Captions (Prerecorded)', level: 'A', intent: 'Prerecorded video with audio is captioned.' },
  { num: '1.2.3', name: 'Audio Description or Media Alternative', level: 'A', intent: 'Prerecorded video has audio description or a full text alternative.' },
  { num: '1.2.4', name: 'Captions (Live)', level: 'AA', intent: 'Live audio content is captioned.' },
  { num: '1.2.5', name: 'Audio Description (Prerecorded)', level: 'AA', intent: 'Prerecorded video has audio description.' },
  { num: '1.3.1', name: 'Info and Relationships', level: 'A', intent: 'Structure conveyed visually — headings, lists, tables — is in the markup too.' },
  { num: '1.3.2', name: 'Meaningful Sequence', level: 'A', intent: 'Reading order matches the order the content is presented in.' },
  { num: '1.3.3', name: 'Sensory Characteristics', level: 'A', intent: 'Instructions do not rely on shape, colour, size or position alone.' },
  { num: '1.3.4', name: 'Orientation', level: 'AA', intent: 'Content is not restricted to one screen orientation.' },
  { num: '1.3.5', name: 'Identify Input Purpose', level: 'AA', intent: 'Form fields collecting user data declare their purpose.' },
  { num: '1.4.1', name: 'Use of Color', level: 'A', intent: 'Colour is never the only way information is conveyed.' },
  { num: '1.4.2', name: 'Audio Control', level: 'A', intent: 'Audio that plays automatically can be stopped.' },
  { num: '1.4.3', name: 'Contrast (Minimum)', level: 'AA', intent: 'Text contrasts at least 4.5:1 with its background (3:1 for large text).' },
  { num: '1.4.4', name: 'Resize Text', level: 'AA', intent: 'Text can be resized to 200% without loss of content or function.' },
  { num: '1.4.5', name: 'Images of Text', level: 'AA', intent: 'Real text is used rather than pictures of text.' },
  { num: '1.4.10', name: 'Reflow', level: 'AA', intent: 'Content reflows to a 320px viewport without two-dimensional scrolling.' },
  { num: '1.4.11', name: 'Non-text Contrast', level: 'AA', intent: 'UI components and meaningful graphics contrast at least 3:1.' },
  { num: '1.4.12', name: 'Text Spacing', level: 'AA', intent: 'No loss of content when text spacing is increased.' },
  { num: '1.4.13', name: 'Content on Hover or Focus', level: 'AA', intent: 'Hover/focus content is dismissible, hoverable and persistent.' },
  { num: '2.1.1', name: 'Keyboard', level: 'A', intent: 'Everything can be operated from a keyboard.' },
  { num: '2.1.2', name: 'No Keyboard Trap', level: 'A', intent: 'Keyboard focus can always move away again.' },
  { num: '2.1.4', name: 'Character Key Shortcuts', level: 'A', intent: 'Single-character shortcuts can be turned off or remapped.' },
  { num: '2.2.1', name: 'Timing Adjustable', level: 'A', intent: 'Time limits can be turned off, adjusted or extended.' },
  { num: '2.2.2', name: 'Pause, Stop, Hide', level: 'A', intent: 'Moving or auto-updating content can be paused.' },
  { num: '2.3.1', name: 'Three Flashes or Below Threshold', level: 'A', intent: 'Nothing flashes more than three times a second.' },
  { num: '2.4.1', name: 'Bypass Blocks', level: 'A', intent: 'Repeated blocks can be skipped.' },
  { num: '2.4.2', name: 'Page Titled', level: 'A', intent: 'Pages have descriptive titles.' },
  { num: '2.4.3', name: 'Focus Order', level: 'A', intent: 'Focus order preserves meaning and operability.' },
  { num: '2.4.4', name: 'Link Purpose (In Context)', level: 'A', intent: 'Link text describes where the link goes.' },
  { num: '2.4.5', name: 'Multiple Ways', level: 'AA', intent: 'More than one way to locate a page within the course.' },
  { num: '2.4.6', name: 'Headings and Labels', level: 'AA', intent: 'Headings and labels describe topic or purpose.' },
  { num: '2.4.7', name: 'Focus Visible', level: 'AA', intent: 'Keyboard focus is always visible.' },
  { num: '2.4.11', name: 'Focus Not Obscured (Minimum)', level: 'AA', intent: 'The focused item is not entirely hidden by other content.' },
  { num: '2.5.1', name: 'Pointer Gestures', level: 'A', intent: 'Multipoint or path-based gestures have a simple alternative.' },
  { num: '2.5.2', name: 'Pointer Cancellation', level: 'A', intent: 'Actions complete on up-event, or can be aborted.' },
  { num: '2.5.3', name: 'Label in Name', level: 'A', intent: "A control's accessible name contains its visible label." },
  { num: '2.5.4', name: 'Motion Actuation', level: 'A', intent: 'Motion-operated functions have a conventional alternative.' },
  { num: '2.5.7', name: 'Dragging Movements', level: 'AA', intent: 'Anything draggable can also be operated without dragging.' },
  { num: '2.5.8', name: 'Target Size (Minimum)', level: 'AA', intent: 'Pointer targets are at least 24 by 24 CSS pixels.' },
  { num: '3.1.1', name: 'Language of Page', level: 'A', intent: 'The language of the page is declared.' },
  { num: '3.1.2', name: 'Language of Parts', level: 'AA', intent: 'Passages in another language are marked up as such.' },
  { num: '3.2.1', name: 'On Focus', level: 'A', intent: 'Focus alone does not trigger a change of context.' },
  { num: '3.2.2', name: 'On Input', level: 'A', intent: 'Changing a setting does not automatically change context.' },
  { num: '3.2.3', name: 'Consistent Navigation', level: 'AA', intent: 'Navigation is in the same relative order on every page.' },
  { num: '3.2.4', name: 'Consistent Identification', level: 'AA', intent: 'The same function is identified consistently.' },
  { num: '3.2.6', name: 'Consistent Help', level: 'A', intent: 'Help mechanisms appear in a consistent place.' },
  { num: '3.3.1', name: 'Error Identification', level: 'A', intent: 'Input errors are described in text.' },
  { num: '3.3.2', name: 'Labels or Instructions', level: 'A', intent: 'Inputs that need user data have labels or instructions.' },
  { num: '3.3.3', name: 'Error Suggestion', level: 'AA', intent: 'Correction suggestions are offered where known.' },
  { num: '3.3.4', name: 'Error Prevention (Legal, Financial, Data)', level: 'AA', intent: 'Consequential submissions are reversible, checked or confirmed.' },
  { num: '3.3.7', name: 'Redundant Entry', level: 'A', intent: 'Information already entered is not asked for again.' },
  { num: '3.3.8', name: 'Accessible Authentication (Minimum)', level: 'AA', intent: 'No cognitive function test is required to authenticate.' },
  { num: '4.1.2', name: 'Name, Role, Value', level: 'A', intent: 'Every control exposes its name, role and state.' },
  { num: '4.1.3', name: 'Status Messages', level: 'AA', intent: 'Status changes are announced without moving focus.' },
]

export function criterionOf(num: string): Criterion | undefined {
  return CRITERIA.find((c) => c.num === num)
}

/**
 * Criteria the exported player satisfies structurally — by how it is built,
 * not by anything the author does. These are asserted by the tool because the
 * player's markup and behaviour are fixed and were built to meet them; an
 * author cannot author their way out of them.
 */
export const PLAYER_SUPPORTED: Record<string, string> = {
  '1.3.2': 'The player renders blocks in document order; visual order and DOM order are the same.',
  '1.4.4': 'All sizing is in relative units; the player reflows rather than clipping at 200% zoom.',
  '1.4.10': 'The player is responsive to 320px with no horizontal scrolling.',
  '1.4.12': 'Layout is flow-based; increased text spacing expands containers rather than clipping.',
  '2.1.1': 'Every interaction — accordions, tabs, flashcards, sequencing, matching, hotspots and quizzes — is operable from the keyboard.',
  '2.1.2': 'The player contains no focus traps; it uses no modal layers.',
  '2.1.4': 'The player defines no single-character shortcuts.',
  '2.2.1': 'The player imposes no time limits on the learner.',
  '2.2.2': 'The player has no auto-updating, moving or auto-playing content.',
  '2.3.1': 'Nothing in the player flashes.',
  '2.4.2': 'The page title is set from the course title.',
  '2.4.7': 'Focus indicators are inherited from the user agent and never suppressed.',
  '3.1.1': 'The exported document declares lang="en".',
  '3.2.1': 'No control changes context on focus.',
  '3.2.2': 'No control changes context on input.',
  '3.2.3': 'Navigation is rendered identically on every lesson.',
  '3.2.4': 'Controls with the same function use the same label throughout.',
  '3.3.7': 'The player never asks for the same information twice.',
  '3.3.8': 'The player has no authentication step.',
}
