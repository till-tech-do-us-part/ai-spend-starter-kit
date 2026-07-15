export function text(value: unknown): string { return String(value).replace(/[&<>"'\u0000-\u001f\u007f]/g, c => `&#${c.charCodeAt(0)};`); }
export const attribute = text;
export function terminal(value: unknown): string { return String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, "?"); }
