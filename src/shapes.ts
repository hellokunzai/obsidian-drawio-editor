/**
 * Stencil definitions for common shapes.
 * Built-in mxGraph shapes + draw.io style strings.
 */

import { tOr } from "./i18n";

export interface ShapeDef {
  id: string;
  name: string;
  style: string;
  width: number;
  height: number;
  icon: string; // SVG path or unicode for palette icon
}

/**
 * Basic flowchart shapes — these use mxGraph's built-in shape rendering.
 * No stencil files needed.
 */
export const BASIC_SHAPES: ShapeDef[] = [
  {
    id: "rect",
    name: "Rectangle",
    style: "rounded=0;whiteSpace=wrap;html=1;",
    width: 120,
    height: 60,
    icon: "M3,3 L21,3 L21,13 L3,13 Z",
  },
  {
    id: "rounded",
    name: "Rounded Rectangle",
    style: "rounded=1;whiteSpace=wrap;html=1;arcSize=20;",
    width: 120,
    height: 60,
    icon: "M5,3 L19,3 Q21,3 21,5 L21,11 Q21,13 19,13 L5,13 Q3,13 3,11 L3,5 Q3,3 5,3 Z",
  },
  {
    id: "square",
    name: "Square",
    style: "rounded=0;whiteSpace=wrap;html=1;",
    width: 80,
    height: 80,
    icon: "M4,4 L20,4 L20,20 L4,20 Z",
  },
  {
    id: "circle",
    name: "Circle",
    style: "shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;",
    width: 80,
    height: 80,
    icon: "M12,3 A9,9 0 1,0 12.01,3 Z",
  },
  {
    id: "ellipse",
    name: "Ellipse",
    style: "shape=ellipse;whiteSpace=wrap;html=1;",
    width: 120,
    height: 80,
    icon: "M12,2 A10,6 0 1,0 12.01,2 Z",
  },
  {
    id: "diamond",
    name: "Diamond",
    style: "shape=rhombus;whiteSpace=wrap;html=1;",
    width: 120,
    height: 80,
    icon: "M12,2 L22,8 L12,14 L2,8 Z",
  },
  {
    id: "parallelogram",
    name: "Parallelogram",
    style: "shape=parallelogram;whiteSpace=wrap;html=1;",
    width: 120,
    height: 60,
    icon: "M6,3 L22,3 L18,13 L2,13 Z",
  },
  {
    id: "hexagon",
    name: "Hexagon",
    style: "shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fixedSize=1;size=0.2;",
    width: 120,
    height: 80,
    icon: "M6,2 L18,2 L22,8 L18,14 L6,14 L2,8 Z",
  },
  {
    id: "triangle",
    name: "Triangle",
    style: "shape=triangle;whiteSpace=wrap;html=1;",
    width: 120,
    height: 80,
    icon: "M12,2 L22,14 L2,14 Z",
  },
  {
    id: "process",
    name: "Process",
    style: "shape=process;whiteSpace=wrap;html=1;",
    width: 120,
    height: 60,
    icon: "M6,3 L8,3 L8,5 L16,5 L16,3 L18,3 L18,13 L16,13 L16,11 L8,11 L8,13 L6,13 Z",
  },
  {
    id: "cylinder",
    name: "Cylinder",
    style: "shape=cylinder;whiteSpace=wrap;html=1;",
    width: 100,
    height: 80,
    icon: "M4,5 A8,3 0 0 0 20,5 L20,15 A8,3 0 0 1 4,15 Z M4,5 A8,3 0 0 1 20,5",
  },
  {
    id: "cloud",
    name: "Cloud",
    style: "shape=cloud;whiteSpace=wrap;html=1;",
    width: 120,
    height: 80,
    icon: "M8,5 Q4,5 4,8 Q1,8 2,11 Q1,13 4,13 Q5,15 8,14 Q12,16 16,14 Q20,15 21,11 Q22,8 18,8 Q18,5 14,5 Q12,3 8,5 Z",
  },
  {
    id: "document",
    name: "Document",
    style: "shape=document;whiteSpace=wrap;html=1;boundedLbl=1;",
    width: 120,
    height: 80,
    icon: "M3,3 L21,3 L21,14 Q18,17 15,14 Q12,11 9,14 Q6,17 3,14 Z",
  },
  {
    id: "internalStorage",
    name: "Internal Storage",
    style: "shape=internalStorage;whiteSpace=wrap;html=1;",
    width: 80,
    height: 80,
    icon: "M3,3 L21,3 L21,21 L3,21 Z M8,3 L8,21 M3,8 L21,8",
  },
  {
    id: "cube",
    name: "Cube",
    style: "shape=cube;whiteSpace=wrap;html=1;",
    width: 100,
    height: 80,
    icon: "M3,7 L8,3 L22,3 L22,17 L17,21 L3,21 Z M3,7 L17,7 L22,3 M17,7 L17,21",
  },
  {
    id: "chevron",
    name: "Chevron",
    style: "shape=chevron;whiteSpace=wrap;html=1;",
    width: 120,
    height: 60,
    icon: "M2,3 L14,3 L22,12 L14,21 L2,21 L10,12 Z",
  },
  {
    id: "trapezoid",
    name: "Trapezoid",
    style: "shape=trapezoid;whiteSpace=wrap;html=1;",
    width: 120,
    height: 60,
    icon: "M7,4 L17,4 L22,20 L2,20 Z",
  },
  {
    id: "tape",
    name: "Tape",
    style: "shape=tape;whiteSpace=wrap;html=1;",
    width: 120,
    height: 60,
    icon: "M2,7 Q7,2 12,7 Q17,12 22,7 L22,17 Q17,22 12,17 Q7,12 2,17 Z",
  },
  {
    id: "note",
    name: "Note",
    style: "shape=note;whiteSpace=wrap;html=1;",
    width: 120,
    height: 80,
    icon: "M3,3 L17,3 L21,7 L21,17 L3,17 Z M17,3 L17,7 L21,7",
  },
  {
    id: "card",
    name: "Card",
    style: "shape=card;whiteSpace=wrap;html=1;boundedLbl=1;",
    width: 120,
    height: 60,
    icon: "M3,3 L17,3 L21,7 L21,13 L3,13 Z M17,3 L17,7 L21,7",
  },
  {
    id: "callout",
    name: "Callout",
    style: "shape=callout;whiteSpace=wrap;html=1;boundedLbl=1;",
    width: 120,
    height: 80,
    icon: "M3,3 L21,3 L21,13 L13,13 L12,16 L11,13 L3,13 Z",
  },
  {
    id: "actor",
    name: "Actor",
    style: "shape=actor;whiteSpace=wrap;html=1;",
    width: 60,
    height: 80,
    icon: "M12,2 A3,3 0 1,0 12.01,2 Z M8,6 L16,6 L18,14 L16,14 L16,20 L14,20 L14,14 L10,14 L10,20 L8,20 L8,14 L6,14 Z",
  },
  {
    id: "moon",
    name: "Moon",
    style: "shape=moon;whiteSpace=wrap;html=1;",
    width: 60,
    height: 80,
    icon: "M15,3 Q5,5 5,12 Q5,19 15,21 Q9,17 9,12 Q9,7 15,3 Z",
  },
  {
    id: "halfEllipse",
    name: "Half Ellipse",
    style: "shape=halfEllipse;whiteSpace=wrap;html=1;",
    width: 60,
    height: 80,
    icon: "M20,3 Q4,3 4,12 Q4,21 20,21 Z",
  },
  {
    id: "curve",
    name: "Curve",
    style: "shape=curve;whiteSpace=wrap;html=1;",
    width: 80,
    height: 80,
    icon: "M3,3 L15,3 Q7,12 15,21 L3,21 Z",
  },
];

/**
 * Edge (connector) styles
 */
export const EDGE_SHAPES: ShapeDef[] = [
  {
    id: "edge-orthogonal",
    name: "Orthogonal Edge",
    style: "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;",
    width: 100,
    height: 60,
    icon: "M4,16 L4,8 L20,8 L20,2",
  },
  {
    id: "edge-curved",
    name: "Curved Edge",
    style: "edgeStyle=orthogonalEdgeStyle;rounded=1;curved=1;html=1;",
    width: 100,
    height: 60,
    icon: "M4,16 Q4,8 12,8 Q20,8 20,2",
  },
  {
    id: "edge-straight",
    name: "Straight Edge",
    style: "edgeStyle=none;rounded=0;html=1;",
    width: 100,
    height: 60,
    icon: "M4,16 L20,2",
  },
  {
    id: "edge-arrow",
    name: "Arrow",
    style: "endArrow=classic;html=1;edgeStyle=orthogonalEdgeStyle;rounded=0;",
    width: 100,
    height: 60,
    icon: "M4,12 L16,12 L16,8 L20,12 L16,16 L16,12",
  },
];

/**
 * Container shapes
 */
export const CONTAINER_SHAPES: ShapeDef[] = [
  {
    id: "swimlane",
    name: "Swimlane",
    style: "shape=swimlane;startSize=20;html=1;",
    width: 200,
    height: 200,
    icon: "M3,3 L21,3 L21,7 L3,7 Z M3,7 L21,7 L21,17 L3,17 Z",
  },
  {
    id: "group",
    name: "Group Container",
    style: "group;",
    width: 200,
    height: 150,
    icon: "M3,3 L21,3 L21,17 L3,17 Z M3,7 L21,7",
  },
];

/**
 * Stencil-based shapes — these use shapes loaded from the stencil XML files.
 * The shape name in the style must match a shape name defined in the stencil files.
 */
export const STENCIL_SHAPES: ShapeDef[] = [
  // Flowchart extended
  { id: "document", name: "Document", style: "shape=document;whiteSpace=wrap;html=1;boundedLbl=1;", width: 120, height: 80, icon: "M3,3 L21,3 L21,14 Q18,17 15,14 Q12,11 9,14 Q6,17 3,14 Z" },
  { id: "data", name: "Data", style: "shape=data;whiteSpace=wrap;html=1;boundedLbl=1;", width: 120, height: 80, icon: "M4,6 Q12,2 20,6 L20,14 Q12,18 4,14 Z M4,6 Q12,10 20,6" },
  { id: "manual_input", name: "Manual Input", style: "shape=manual_input;whiteSpace=wrap;html=1;boundedLbl=1;", width: 120, height: 60, icon: "M6,3 L22,3 L18,13 L2,13 Z" },
  { id: "preparation", name: "Preparation", style: "shape=preparation;whiteSpace=wrap;html=1;boundedLbl=1;", width: 120, height: 80, icon: "M6,2 L18,2 L22,8 L18,14 L6,14 L2,8 Z" },
  { id: "display", name: "Display", style: "shape=display;whiteSpace=wrap;html=1;boundedLbl=1;", width: 120, height: 60, icon: "M2,3 L18,3 L22,8 L22,13 L2,13 Z" },
  { id: "card", name: "Card", style: "shape=card;whiteSpace=wrap;html=1;boundedLbl=1;", width: 120, height: 60, icon: "M3,3 L17,3 L21,7 L21,13 L3,13 Z M17,3 L17,7 L21,7" },
  { id: "callout", name: "Callout", style: "shape=callout;whiteSpace=wrap;html=1;boundedLbl=1;", width: 120, height: 80, icon: "M3,3 L21,3 L21,13 L13,13 L12,16 L11,13 L3,13 Z" },

  // UML
  { id: "umlClass", name: "UML Class", style: "shape=umlClass;whiteSpace=wrap;html=1;", width: 120, height: 80, icon: "M3,3 L21,3 L21,17 L3,17 Z M3,7 L21,7 M3,12 L21,12" },
  { id: "umlActor", name: "Actor", style: "shape=umlActor;whiteSpace=wrap;html=1;", width: 60, height: 80, icon: "M12,2 A3,3 0 1,0 12.01,2 Z M9,6 L15,6 L16,12 L14,12 L14,18 L10,18 L10,12 L8,12 Z" },
  { id: "umlUseCase", name: "Use Case", style: "shape=umlUseCase;whiteSpace=wrap;html=1;", width: 120, height: 50, icon: "M12,2 A10,5 0 1,0 12.01,2 Z" },
  { id: "umlPackage", name: "Package", style: "shape=umlPackage;whiteSpace=wrap;html=1;", width: 120, height: 80, icon: "M3,5 L8,5 L8,3 L21,3 L21,15 L3,15 Z" },
  { id: "umlNote", name: "Note", style: "shape=umlNote;whiteSpace=wrap;html=1;boundedLbl=1;", width: 120, height: 60, icon: "M3,3 L17,3 L21,7 L21,15 L3,15 Z M17,3 L17,7 L21,7" },

  // Network
  { id: "server", name: "Server", style: "shape=server;whiteSpace=wrap;html=1;", width: 80, height: 80, icon: "M5,3 L19,3 L19,21 L5,21 Z M5,8 L19,8 M5,13 L19,13 M5,18 L19,18" },
  { id: "cloud", name: "Cloud", style: "shape=cloud;whiteSpace=wrap;html=1;", width: 120, height: 80, icon: "M8,12 Q4,12 5,8 Q5,4 10,5 Q12,2 16,3 Q20,3 20,7 Q24,8 22,12 Q24,16 18,16 Q14,18 10,16 Q6,16 8,12 Z" },
  { id: "database", name: "Database", style: "shape=database;whiteSpace=wrap;html=1;boundedLbl=1;", width: 100, height: 80, icon: "M3,5 Q12,1 21,5 L21,17 Q12,21 3,17 Z M3,5 Q12,9 21,5" },
  { id: "firewall", name: "Firewall", style: "shape=firewall;whiteSpace=wrap;html=1;", width: 100, height: 80, icon: "M3,3 L21,3 L21,21 L3,21 Z M3,3 L21,21 M21,3 L3,21 M12,3 L12,21 M3,12 L21,12" },
  { id: "router", name: "Router", style: "shape=router;whiteSpace=wrap;html=1;", width: 100, height: 60, icon: "M3,8 L21,8 L21,16 L3,16 Z" },
  { id: "user", name: "User", style: "shape=user;whiteSpace=wrap;html=1;", width: 80, height: 80, icon: "M12,3 A3,3 0 1,0 12.01,3 Z M8,8 L16,8 L18,18 L6,18 Z" },

  // Misc
  { id: "gear", name: "Gear", style: "shape=gear;whiteSpace=wrap;html=1;", width: 80, height: 80, icon: "M12,8 A4,4 0 1,0 12.01,8 Z" },
  { id: "envelope", name: "Email", style: "shape=envelope;whiteSpace=wrap;html=1;", width: 120, height: 60, icon: "M3,3 L21,3 L21,15 L3,15 Z M3,3 L12,10 L21,3" },
  { id: "folder", name: "Folder", style: "shape=folder;whiteSpace=wrap;html=1;tabWidth=30;tabHeight=15;", width: 120, height: 80, icon: "M3,6 L9,6 L11,3 L21,3 L21,15 L3,15 Z" },
  { id: "star", name: "Star", style: "shape=star;whiteSpace=wrap;html=1;", width: 80, height: 80, icon: "M12,2 L14,8 L20,8 L15,12 L17,18 L12,14 L7,18 L9,12 L4,8 L10,8 Z" },
  { id: "clock", name: "Clock", style: "shape=clock;whiteSpace=wrap;html=1;", width: 80, height: 80, icon: "M12,2 A10,10 0 1,0 12.01,2 Z M12,7 L12,12 L16,14" },
  { id: "lock", name: "Lock", style: "shape=lock;whiteSpace=wrap;html=1;", width: 80, height: 80, icon: "M6,10 L18,10 L18,20 L6,20 Z M9,10 L9,6 A3,3 0 0,1 15,6 L15,10" },
  { id: "speechBubble", name: "Speech", style: "shape=speechBubble;whiteSpace=wrap;html=1;boundedLbl=1;", width: 120, height: 70, icon: "M3,3 L21,3 L21,12 L7,12 L4,15 L5,12 L3,12 Z" },
  { id: "flag", name: "Flag", style: "shape=flag;whiteSpace=wrap;html=1;", width: 80, height: 80, icon: "M5,3 L5,21 M5,3 L17,3 L17,8 L5,8" },
  { id: "heart", name: "Heart", style: "shape=heart;whiteSpace=wrap;html=1;", width: 80, height: 80, icon: "M12,20 Q4,14 4,8 Q4,4 8,4 Q12,4 12,8 Q12,4 16,4 Q20,4 20,8 Q20,14 12,20 Z" },
];

export interface ShapeCategory {
  /** i18n key suffix, resolved as `shapeCategory.<key>`. */
  key: string;
  /** English fallback title, used when no translation is registered. */
  title: string;
  shapes: ShapeDef[];
}

/**
 * Get all shape categories for the palette.
 * Titles are i18n keys — resolve them with `t(`shapeCategory.${key}`)`.
 */
export function getAllShapeCategories(): ShapeCategory[] {
  return [
    { key: "basic", title: "Basic Shapes", shapes: BASIC_SHAPES },
    { key: "edges", title: "Edges", shapes: EDGE_SHAPES },
    { key: "containers", title: "Containers", shapes: CONTAINER_SHAPES },
    { key: "flowchart", title: "Flowchart", shapes: STENCIL_SHAPES.filter(s => ["document", "data", "manual_input", "preparation", "display", "card", "callout"].includes(s.id)) },
    { key: "uml", title: "UML", shapes: STENCIL_SHAPES.filter(s => ["umlClass", "umlActor", "umlUseCase", "umlPackage", "umlNote"].includes(s.id)) },
    { key: "network", title: "Network", shapes: STENCIL_SHAPES.filter(s => ["server", "cloud", "database", "firewall", "router", "user"].includes(s.id)) },
    { key: "icons", title: "Icons", shapes: STENCIL_SHAPES.filter(s => ["gear", "envelope", "folder", "star", "clock", "lock", "speechBubble", "flag", "heart"].includes(s.id)) },
  ];
}

/** Localized display name for a shape, falling back to its built-in name. */
export function getShapeLabel(shape: ShapeDef): string {
  return tOr(`shape.${shape.id}`, shape.name);
}
