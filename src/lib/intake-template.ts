export const TEMPLATE_VARS = {
  "{{firstName}}": "Recipient's first name",
  "{{name}}": "Recipient's full name",
  "{{projectName}}": "Project name",
  "{{link}}": "Intake form URL",
} as const;

export const DEFAULT_SUBJECT = "{{projectName}} on indieFilmer";

export const DEFAULT_BODY = `Hi {{firstName}},

You've been added to {{projectName}} on indieFilmer.

When you get a chance, could you fill out this form? Some info might already be there. Just fill in whatever's missing and hit submit.

{{link}}

Best,
{{projectName}} Team`;

export type TemplateVars = {
  firstName: string;
  name: string;
  projectName: string;
  link: string;
};

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{firstName\}\}/g, vars.firstName)
    .replace(/\{\{name\}\}/g, vars.name)
    .replace(/\{\{projectName\}\}/g, vars.projectName)
    .replace(/\{\{link\}\}/g, vars.link);
}
