/**
 * @param {{
 *   url: string,
 *   title: string,
 *   sandbox?: string
 * }} props
 */
export default function EmbeddedAppFrame({ url, title, sandbox }) {
  const sandboxValue = sandbox ?? 'allow-scripts allow-same-origin allow-forms allow-popups'

  if (!url) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">Keine URL konfiguriert</p>
          <p className="text-gray-600 text-sm">{title}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative bg-gray-900">
      <iframe
        src={url}
        title={title}
        sandbox={sandboxValue}
        className="w-full h-full border-none"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  )
}
