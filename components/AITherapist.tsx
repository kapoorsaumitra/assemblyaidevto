'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, MicOff } from 'lucide-react'
import { AssemblyAI } from 'assemblyai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { remark } from 'remark'
import html from 'remark-html'
import { ThemeToggle } from './ThemeToggle'

// Initialize AssemblyAI client
const assemblyClient = new AssemblyAI({
  apiKey: process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY || '',
})

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY || '')

export function AITherapist() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      audioChunks.current = []

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data)
      }

      mediaRecorder.current.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' })
          await processAudio(audioBlob)
        } catch (error) {
          console.error('Error processing audio:', error)
          setError('An error occurred while processing the audio. Please try again.')
        }
      }

      mediaRecorder.current.start()
      setIsRecording(true)
      setError(null)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      setError('Unable to access the microphone. Please check your permissions and try again.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true)
    setError(null)
    try {
      // Transcribe audio using AssemblyAI
      const response = await assemblyClient.transcripts.transcribe({
        audio: audioBlob,
      })

      if (response?.text) {
        setTranscript(response.text)

        // Summarize the transcript (simple approach)
        const summary = summarizeTranscript(response.text)

        // Get AI therapist response using Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
        const prompt = `As an AI therapist, provide a thoughtful and supportive response to the following patient statement: "${summary}". Use Markdown formatting to structure your response.`
        const result = await model.generateContent(prompt)
        const aiTherapistResponse = result.response.text()
        
        if (aiTherapistResponse) {
          setAiResponse(aiTherapistResponse)
        } else {
          setError('Failed to get AI response. Please try again.')
        }
      } else {
        setError('Failed to transcribe audio. Please try again.')
      }
    } catch (error) {
      console.error('Error processing audio:', error)
      setError('An error occurred while processing your request. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const summarizeTranscript = (text: string): string => {
    // Simple summarization: take the first 100 words
    const words = text.split(' ')
    return words.slice(0, 100).join(' ') + (words.length > 100 ? '...' : '')
  }

  const renderMarkdown = (content: string) => {
    try {
      return remark()
        .use(html)
        .processSync(content)
        .toString()
    } catch (error) {
      console.error('Error rendering markdown:', error)
      return '<p>Error rendering response. Please try again.</p>'
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>AI Therapist</CardTitle>
        <ThemeToggle />
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className="w-full"
        >
          {isRecording ? (
            <>
              <MicOff className="mr-2 h-4 w-4" /> Stop Recording
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" /> Start Recording
            </>
          )}
        </Button>
        {isProcessing && <p>Processing your audio...</p>}
        {error && <p className="text-red-500 dark:text-red-400">{error}</p>}
        {transcript && (
          <div>
            <h3 className="font-semibold">Your message:</h3>
            <p>{transcript}</p>
          </div>
        )}
        {aiResponse && (
          <div>
            <h3 className="font-semibold">AI Therapist Response:</h3>
            <div 
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(aiResponse) }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

