import React, { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  show?: boolean
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, show = true }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 12,
      })
    }
  }, [isVisible])

  if (!show) {
    return <>{children}</>
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="relative"
      >
        {children}
      </div>
      {isVisible && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ top: `${position.top}px`, left: `${position.left}px`, transform: 'translateY(-50%)' }}
        >
          <div className="relative">
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-gray-900 dark:border-r-gray-100" />
            <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shadow-xl backdrop-blur-sm">
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
