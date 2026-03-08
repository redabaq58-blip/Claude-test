import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

// ─── Code block with language label + copy button ─────────────────────────────

function CodeBlock({
  inline,
  className,
  children,
  ...props
}: {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className ?? '')
  const lang = match?.[1] ?? ''
  const code = String(children ?? '').replace(/\n$/, '')

  if (inline) {
    return (
      <code className="bg-gray-800 text-brand-300 px-1 py-0.5 rounded text-[0.85em] font-mono" {...props}>
        {children}
      </code>
    )
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-gray-700">
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800 border-b border-gray-700">
        <span className="text-xs font-mono text-gray-500">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 bg-gray-900 m-0">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  )
}

// ─── MarkdownRenderer ─────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-body text-gray-200 text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: CodeBlock,

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-gray-700 rounded-lg overflow-hidden text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-800">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-gray-300 border-b border-gray-800">{children}</td>
          ),
          tr: ({ children }) => <tr className="hover:bg-gray-800/40 transition-colors">{children}</tr>,

          // Typography
          h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-5 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-gray-200 mt-3 mb-1.5">{children}</h3>,
          h4: ({ children }) => <h4 className="font-medium text-gray-300 mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="text-gray-300 my-2 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
          em: ({ children }) => <em className="text-gray-200 italic">{children}</em>,

          // Lists
          ul: ({ children }) => <ul className="list-disc list-outside ml-5 my-2 space-y-1 text-gray-300">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-5 my-2 space-y-1 text-gray-300">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-brand-600 pl-4 py-1 my-3 bg-brand-950/20 rounded-r-lg text-gray-400 italic">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="border-gray-700 my-4" />,

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
