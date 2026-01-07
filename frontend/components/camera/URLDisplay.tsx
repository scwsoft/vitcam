import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, ExternalLink } from 'lucide-react'

interface URLDisplayProps {
  url: string
}

function maskURL(url: string): string {
  try {
    const urlObj = new URL(url)
    if (urlObj.username || urlObj.password) {
      const maskedAuth = urlObj.username ? `${urlObj.username.substring(0, 2)}***:***` : ''
      return `${urlObj.protocol}//${maskedAuth}@${urlObj.host}${urlObj.pathname}${urlObj.search}`
    }
    return url
  } catch {
    const credentialRegex = /^(.*:\/\/)([^:@]+)(:[^@]+)?@(.*)$/
    const match = url.match(credentialRegex)
    if (match) {
      const [, protocol, username, , rest] = match
      return `${protocol}${username.substring(0, 2)}***:***@${rest}`
    }
    return url
  }
}

export function URLDisplay({ url }: URLDisplayProps) {
  const [showUrl, setShowUrl] = useState(false)

  return (
    <div className="flex items-center gap-2 max-w-xs">
      <code className="text-sm px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 flex-1 truncate font-mono text-slate-700 dark:text-slate-300">
        {showUrl ? url : maskURL(url)}
      </code>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setShowUrl(!showUrl)}
        className="hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
      >
        {showUrl ? <EyeOff size={14} /> : <Eye size={14} />}
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        asChild
        className="hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} />
        </a>
      </Button>
    </div>
  )
}