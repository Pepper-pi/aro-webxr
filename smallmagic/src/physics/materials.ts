// Materials and welds. Every piece of a structure is one rigid body of one material; neighbours are
// held by welds (three-avbd fixed joints). A weld's kind comes from the two materials it joins, and
// sets how it fails: brittle (mortar, putty: a clean break), plastic (timber joinery sags and then
// snaps; steel bends a long way and holds), or both.
//
// Units: lengths in metres, density in tonnes per cubic metre (so masses are in tonnes and forces
// in kN as far as the solver is concerned: only ratios matter to it).

export type Mat = 'timber' | 'board' | 'brick' | 'stone' | 'glass' | 'steel' | 'tile' | 'plaster' | 'ground';

export interface MatInfo {
  density: number;
  friction: number;
  /** What it sounds like (audio.ts Material). */
  sound: 'wood' | 'brick' | 'concrete' | 'glass' | 'metal' | 'plaster';
  /** How hard it is for the hand tools: 0 soft (sledge breaks it), 1 medium (sledge chips), 2 hard (sledge bounces). */
  hardness: number;
  /** Dust colour when it breaks (linear-ish sRGB hex). */
  dust: number;
  /** Counted in the demolition share by volume times this (glass and tiles count for less). */
  worth: number;
}

export const MATS: Record<Mat, MatInfo> = {
  timber: { density: 0.65, friction: 0.65, sound: 'wood', hardness: 1, dust: 0xa8977c, worth: 1 },
  board: { density: 0.55, friction: 0.6, sound: 'wood', hardness: 0, dust: 0xbfa27a, worth: 1 },
  brick: { density: 1.9, friction: 0.75, sound: 'brick', hardness: 1, dust: 0xae9180, worth: 1 },
  stone: { density: 2.4, friction: 0.8, sound: 'concrete', hardness: 2, dust: 0xc8bba6, worth: 1 },
  glass: { density: 2.5, friction: 0.4, sound: 'glass', hardness: 0, dust: 0xdfe8ea, worth: 0.3 },
  steel: { density: 7.8, friction: 0.45, sound: 'metal', hardness: 2, dust: 0x8a8378, worth: 1 },
  tile: { density: 1.9, friction: 0.7, sound: 'brick', hardness: 0, dust: 0xa88c78, worth: 0.6 },
  plaster: { density: 1.3, friction: 0.7, sound: 'plaster', hardness: 0, dust: 0xe8e0d0, worth: 1 },
  ground: { density: 0, friction: 0.9, sound: 'concrete', hardness: 3, dust: 0x9a8a70, worth: 0 },
};

/** How two pieces are joined. */
export type WeldKind = 'living' | 'grain' | 'joinery' | 'mortar' | 'nogging' | 'putty' | 'nail' | 'rivet' | 'bolt' | 'footing' | 'stonework' | 'tie';

export interface WeldRule {
  /**
   * It breaks at `margin` times the load it carries standing (measured once the structure has
   * settled), and never below `floor` g: the weight of the lighter of its two pieces, that many
   * times over (what a knock, or the shake of a collapse next door, can't break).
   */
  margin: number;
  floor: number;
  /**
   * Brittle welds (mortar, putty, nails) break on a pull or a push as well as a bend: their
   * standing load is the larger of the two. Plastic ones (timber, steel) only on a bend, and their
   * standing load is their bending load alone (a post carrying a storey in compression is no
   * stiffer for it against a sideways shove).
   */
  pull: boolean;
  /**
   * Plastic: past `yieldMargin` times its standing bending load (never below `yieldFloor` g) it
   * gives and stays bent, and it snaps once bent `bend` rad from where it started. A plastic weld's
   * angular force never passes its yield, so its strength only catches a sudden jump (an impact).
   */
  yieldMargin?: number;
  yieldFloor?: number;
  bend?: number;
}

/**
 * The rules, tuned in Timberfall's lab: a weld stands with room to spare and shrugs off the shake
 * of a collapse next door, timber that's asked to carry far more than it was built for sags and
 * snaps, masonry that loses what's under it cracks away, and steel bends a long way. The floors are
 * about three times Timberfall's: the demo's structures are small, so their welds carry little
 * standing, and the mill's floors let one cannonball shake a whole barn's boards off.
 */
export const WELDS: Record<WeldKind, WeldRule> = {
  // A living tree (the meadow's own addition): it holds whatever is asked of it. It comes apart only when a spell cuts it.
  living: { margin: 1e5, floor: 1e5, pull: false },
  // Along one timber member: sags, then snaps across the grain
  grain: { margin: 6, floor: 90, pull: false, yieldMargin: 1.5, yieldFloor: 4, bend: 0.2 },
  // Pegged mortise and tenon, half-laps: gives sooner than the timber itself
  joinery: { margin: 6, floor: 70, pull: false, yieldMargin: 1.3, yieldFloor: 2.5, bend: 0.26 },
  // Brick on brick, and brick on stone
  mortar: { margin: 3, floor: 40, pull: true },
  // Brick infill against the timber frame: barely held
  nogging: { margin: 2.5, floor: 30, pull: true },
  // Glass in its frame
  putty: { margin: 2.5, floor: 30, pull: true },
  // Boards, tiles and battens nailed on
  nail: { margin: 3, floor: 60, pull: true },
  // Steel to steel: bends a long way, rarely lets go
  // (It tears on a pull or a push of three times what it carries standing: a brace that ends up
  // propping the tower's weight buckles off it)
  rivet: { margin: 3, floor: 60, pull: true, yieldMargin: 1.5, yieldFloor: 2, bend: 1.2 },
  // Steel to anything else
  bolt: { margin: 6, floor: 40, pull: false, yieldMargin: 1.4, yieldFloor: 2, bend: 0.7 },
  // Into the ground: only a charge shifts it
  footing: { margin: 6, floor: 80, pull: true },
  // Iron ties holding the chimney to the gable: they let go once it leans away
  tie: { margin: 2.5, floor: 2, pull: true },
  // Dressed stone on stone (plinth, piers)
  stonework: { margin: 4, floor: 60, pull: true },
};

/** The weld between two materials. */
export function weldKind(a: Mat, b: Mat, sameMember: boolean): WeldKind {
  if (a === 'ground' || b === 'ground') return 'footing';
  if (sameMember) return a === 'steel' ? 'rivet' : 'grain';
  if (a === 'glass' || b === 'glass') return 'putty';
  if (a === 'steel' && b === 'steel') return 'rivet';
  if (a === 'steel' || b === 'steel') return 'bolt';
  const masonry = (m: Mat) => m === 'brick' || m === 'stone' || m === 'plaster';
  if (a === 'stone' && b === 'stone') return 'stonework';
  if (masonry(a) && masonry(b)) return 'mortar';
  if (masonry(a) || masonry(b)) return 'nogging';
  if (a === 'board' || b === 'board' || a === 'tile' || b === 'tile') return 'nail';
  return 'joinery';
}
