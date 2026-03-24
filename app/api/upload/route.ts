import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function getSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("session")
  if (!sessionCookie) return null

  try {
    return JSON.parse(sessionCookie.value)
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const uploadType = formData.get('type') as string // 'image' or 'invoice'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type based on upload type
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const invoiceTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    
    const allowedTypes = uploadType === 'invoice' ? [...invoiceTypes, ...imageTypes] : imageTypes
    
    if (!allowedTypes.includes(file.type)) {
      const allowedExtensions = uploadType === 'invoice' 
        ? 'PDF, DOC, DOCX, XLS, XLSX, or images' 
        : 'images (JPEG, PNG, GIF, WEBP)'
      return NextResponse.json({ error: `Invalid file type. Only ${allowedExtensions} are allowed.` }, { status: 400 })
    }

    // Validate file size (max 10MB for invoices, 5MB for images)
    const maxSize = uploadType === 'invoice' ? 10 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      const maxSizeMB = uploadType === 'invoice' ? '10MB' : '5MB'
      return NextResponse.json({ error: `File too large. Maximum size is ${maxSizeMB}.` }, { status: 400 })
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const folder = uploadType === 'invoice' ? 'invoices' : 'ticket-attachments'
    const filename = `${folder}/${timestamp}-${file.name}`

    const blob = await put(filename, file, {
      access: 'public',
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
