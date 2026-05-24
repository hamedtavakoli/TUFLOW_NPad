import { stripInlineComment } from './parser';

export function formatTuflowText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || /^(!|#|\/\/)/.test(trimmed) || !stripInlineComment(line).includes('==')) {
        return line;
      }

      const commentMatch = line.match(/(\s(?:!|#|\/\/).*)$/);
      const comment = commentMatch?.[1] ?? '';
      const withoutComment = comment ? line.slice(0, -comment.length) : line;
      const [command, ...rest] = withoutComment.split('==');
      return `${command.trim()} == ${rest.join('==').trim()}${comment}`;
    })
    .join('\n');
}
