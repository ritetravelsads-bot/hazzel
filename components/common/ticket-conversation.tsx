"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { 
  Send, 
  Paperclip, 
  X, 
  Image as ImageIcon, 
  Loader2,
  User,
  Headphones,
  Clock,
  CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface Message {
  id: string
  message: string
  sender_type: "customer" | "customer_user" | "agent"
  sender_id: string
  sender_name?: string
  attachments?: string[]
  created_at: string
}

interface TicketConversationProps {
  ticketId: string
  senderType: "customer" | "customer_user" | "agent"
  senderId: string
  senderName?: string
  ticketStatus?: string
  hasTeamReplied?: boolean
  onStatusChange?: () => void
}

export function TicketConversation({
  ticketId,
  senderType,
  senderId,
  senderName,
  ticketStatus,
  hasTeamReplied = false,
  onStatusChange,
}: TicketConversationProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<string[]>([])
  const [previewImages, setPreviewImages] = useState<{ url: string; file: File }[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    fetchMessages()
    // Poll for new messages every 10 seconds
    const interval = setInterval(fetchMessages, 10000)
    return () => clearInterval(interval)
  }, [ticketId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/messages?ticketId=${ticketId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data)
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only image files are allowed (JPEG, PNG, GIF, WebP)")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB")
      return
    }

    // Create preview
    const previewUrl = URL.createObjectURL(file)
    setPreviewImages(prev => [...prev, { url: previewUrl, file }])

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removePreviewImage = (index: number) => {
    setPreviewImages(prev => {
      const newPreviews = [...prev]
      URL.revokeObjectURL(newPreviews[index].url)
      newPreviews.splice(index, 1)
      return newPreviews
    })
  }

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = []
    
    for (const preview of previewImages) {
      const formData = new FormData()
      formData.append('file', preview.file)
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const data = await response.json()
        uploadedUrls.push(data.url)
      } else {
        throw new Error('Failed to upload image')
      }
    }
    
    return uploadedUrls
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() && previewImages.length === 0) return

    setSending(true)
    setUploading(previewImages.length > 0)

    try {
      // Upload images first if any
      let uploadedAttachments: string[] = []
      if (previewImages.length > 0) {
        uploadedAttachments = await uploadImages()
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticketId,
          message: newMessage.trim() || "Shared an image",
          attachments: uploadedAttachments,
        }),
      })

      if (response.ok) {
        setNewMessage("")
        // Clear previews
        previewImages.forEach(p => URL.revokeObjectURL(p.url))
        setPreviewImages([])
        setAttachments([])
        fetchMessages()
        
        // Notify parent to refresh ticket data if agent replied
        if (senderType === "agent" && onStatusChange) {
          onStatusChange()
        }
      } else {
        toast.error("Failed to send message")
      }
    } catch (error) {
      console.error("Send message error:", error)
      toast.error("Failed to send message")
    } finally {
      setSending(false)
      setUploading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const isOwnMessage = (message: Message) => {
    return message.sender_type === senderType && message.sender_id === senderId
  }

  const getSenderInfo = (message: Message) => {
    const isAgent = message.sender_type === "agent"
    return {
      name: message.sender_name || (isAgent ? "Support Agent" : "Customer"),
      initials: (message.sender_name || (isAgent ? "SA" : "CU")).substring(0, 2).toUpperCase(),
      isAgent,
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[500px] bg-muted/30 rounded-lg">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Headphones className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Start the conversation</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Send a message to begin discussing this ticket
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const senderInfo = getSenderInfo(message)
              const isOwn = isOwnMessage(message)

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    isOwn ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <Avatar className={cn(
                    "h-9 w-9 shrink-0",
                    senderInfo.isAgent ? "bg-primary" : "bg-secondary"
                  )}>
                    <AvatarFallback className={cn(
                      "text-xs font-medium",
                      senderInfo.isAgent ? "bg-primary text-primary-foreground" : "bg-secondary"
                    )}>
                      {senderInfo.initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className={cn(
                    "flex flex-col max-w-[70%]",
                    isOwn ? "items-end" : "items-start"
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{senderInfo.name}</span>
                      {senderInfo.isAgent && (
                        <Badge variant="secondary" className="text-xs py-0 px-1.5">
                          Support
                        </Badge>
                      )}
                    </div>

                    <Card className={cn(
                      "shadow-sm",
                      isOwn 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-card"
                    )}>
                      <CardContent className="p-3">
                        {message.message && (
                          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                        )}
                        
                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className={cn(
                            "grid gap-2 mt-2",
                            message.attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"
                          )}>
                            {message.attachments.map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                              >
                                <img
                                  src={url}
                                  alt={`Attachment ${index + 1}`}
                                  className="w-full h-auto max-h-48 object-cover"
                                  crossOrigin="anonymous"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(message.created_at), "MMM d, h:mm a")}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Image Previews */}
      {previewImages.length > 0 && (
        <div className="flex gap-2 p-3 border-t bg-muted/50">
          {previewImages.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview.url}
                alt={`Preview ${index + 1}`}
                className="h-16 w-16 object-cover rounded-lg border"
              />
              <button
                onClick={() => removePreviewImage(index)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Message Input */}
      {ticketStatus !== "closed" && ticketStatus !== "resolved" ? (
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="min-h-[80px] pr-12 resize-none"
                disabled={sending}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 bottom-2 h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || previewImages.length >= 4}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={sending || (!newMessage.trim() && previewImages.length === 0)}
              className="h-auto px-4"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploading ? "Uploading..." : "Sending..."}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line. Max 4 images, 5MB each.
          </p>
        </div>
      ) : (
        <div className="p-4 border-t bg-muted/50 text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">This ticket has been {ticketStatus}</span>
          </div>
        </div>
      )}
    </div>
  )
}
