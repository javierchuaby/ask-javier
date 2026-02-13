"use client";

import { Components } from "react-markdown";

export const markdownComponents: Components = {
  p: ({ children }) => <p className="markdown-paragraph">{children}</p>,
  ul: ({ children }) => (
    <ul className="markdown-list markdown-list-unordered">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="markdown-list markdown-list-ordered">{children}</ol>
  ),
  li: ({ children }) => <li className="markdown-list-item">{children}</li>,
  code: ({ className, children, ..._props }) => {
    const isInline = !className;
    return isInline ? (
      <code className="markdown-code-inline">{children}</code>
    ) : (
      <code className={className}>{children}</code>
    );
  },
  pre: ({ children }) => <pre className="markdown-code-block">{children}</pre>,
  h1: ({ children }) => (
    <h1 className="markdown-heading markdown-heading-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="markdown-heading markdown-heading-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="markdown-heading markdown-heading-3">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="markdown-heading markdown-heading-4">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="markdown-heading markdown-heading-5">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="markdown-heading markdown-heading-6">{children}</h6>
  ),
  strong: ({ children }) => (
    <strong className="markdown-strong">{children}</strong>
  ),
  em: ({ children }) => <em className="markdown-em">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="markdown-blockquote">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="markdown-link"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="markdown-table-wrapper">
      <table className="markdown-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="markdown-table-head">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="markdown-table-body">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="markdown-table-row">{children}</tr>,
  th: ({ children }) => <th className="markdown-table-header">{children}</th>,
  td: ({ children }) => <td className="markdown-table-cell">{children}</td>,
  hr: () => <hr className="markdown-hr" />,
};
