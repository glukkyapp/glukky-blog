import type { HTMLAttributes } from "react";

interface MascotSpeechBubbleProps extends HTMLAttributes<HTMLDivElement> {
  mascotSrc: string;
  message: string;
  testId?: string;
}

export function MascotSpeechBubble({ mascotSrc, message, testId, className = "", ...props }: MascotSpeechBubbleProps) {
  return (
    <div className={`mascot-speech-bubble ${className}`} data-testid={testId} {...props}>
      <img className="mascot-speech-bubble__mascot" src={mascotSrc} alt="" aria-hidden="true" />
      <p className="mascot-speech-bubble__message">{message}</p>
    </div>
  );
}