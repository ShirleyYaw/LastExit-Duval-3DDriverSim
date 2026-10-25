/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * Small kit of iOS-style building blocks (see the .ios-* rules in index.css):
 *  - IOSNotification: frosted-glass banner like a native iPhone alert
 *  - IOSMessagesThread: a Messages conversation with received/sent bubbles
 *  - IOSBubble, IOSAppIcon
 */

type IconKind = 'messages' | 'jury';

/** App icon in iOS's rounded-square ("squircle") shape. */
export const IOSAppIcon: React.FC<{ kind: IconKind; size?: number }> = ({ kind, size = 38 }) => {
  const bg =
    kind === 'messages'
      ? 'linear-gradient(180deg, #67e86f 0%, #25c43e 100%)'
      : 'linear-gradient(180deg, #5ac8fa 0%, #0a64d8 100%)';
  return (
    <div
      className="shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.2237, background: bg, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.12)' }}
      aria-hidden="true"
    >
      {kind === 'messages' ? (
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="#fff">
          <path d="M12 3.5C6.8 3.5 2.6 6.9 2.6 11.1c0 2.2 1.2 4.2 3.1 5.6-.1 1.2-.6 2.3-1.5 3.2a.4.4 0 0 0 .3.7c1.9-.1 3.4-.8 4.4-1.5 1 .3 2.1.5 3.1.5 5.2 0 9.4-3.4 9.4-7.5S17.2 3.5 12 3.5z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0L5 7zm14 0l-3 7a3.5 3.5 0 0 0 6 0l-3-7z" />
        </svg>
      )}
    </div>
  );
};

interface IOSNotificationProps {
  icon: IconKind;
  title: string;
  body: React.ReactNode;
  time?: string;
  /** Optional action area (buttons, captions) shown under the message. */
  children?: React.ReactNode;
  className?: string;
}

/** Frosted-glass notification banner, as it appears over the game UI. */
export const IOSNotification: React.FC<IOSNotificationProps> = ({ icon, title, body, time = 'now', children, className = '' }) => (
  <div className={`ios ios-glass ios-banner ios-banner-in p-3 ${className}`} role="alert">
    <div className="flex items-start gap-3">
      <IOSAppIcon kind={icon} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold leading-5 truncate">{title}</span>
          <span className="ios-secondary text-[13px] shrink-0">{time}</span>
        </div>
        <div className="text-[15px] leading-[20px] mt-0.5 text-black/90">{body}</div>
      </div>
    </div>
    {children && <div className="mt-2.5">{children}</div>}
  </div>
);

export const IOSBubble: React.FC<{ side: 'received' | 'sent'; tail?: boolean; children: React.ReactNode }> = ({
  side,
  tail = true,
  children,
}) => <div className={`ios-bubble ${side}${tail ? ' tail' : ''}`}>{children}</div>;

/** iOS contact avatar: grey gradient with initials. */
const IOSAvatar: React.FC<{ name: string; size?: number }> = ({ name, size = 30 }) => (
  <div
    className="shrink-0 rounded-full text-white font-semibold flex items-center justify-center"
    style={{ width: size, height: size, fontSize: size * 0.45, background: 'linear-gradient(180deg,#a6abb8 0%,#858a97 100%)' }}
  >
    {name.trim()[0]?.toUpperCase()}
  </div>
);

interface IOSMessagesThreadProps {
  contact: string;
  timeLabel: string;
  received: string;
  /** If set, an outgoing blue bubble (and "Delivered") is shown. */
  sent?: string | null;
  className?: string;
}

/** A Messages conversation: white thread, grey received bubble, blue sent bubble. */
export const IOSMessagesThread: React.FC<IOSMessagesThreadProps> = ({ contact, timeLabel, received, sent, className = '' }) => (
  <div className={`ios ios-thread rounded-[20px] overflow-hidden ${className}`} style={{ boxShadow: '0 8px 26px rgba(0,0,0,0.25), 0 2px 5px rgba(0,0,0,0.12)' }}>
    <div className="ios-glass flex items-center gap-2 px-3 py-1.5" style={{ borderRadius: 0, boxShadow: 'none', borderWidth: '0 0 0.5px 0', borderColor: 'rgba(60,60,67,0.2)' }}>
      <IOSAvatar name={contact} />
      <div className="leading-tight">
        <div className="text-[14px] font-semibold text-black">{contact}</div>
        <div className="ios-secondary text-[11px]">iMessage</div>
      </div>
    </div>
    <div className="flex flex-col gap-1 px-4 pt-2 pb-2.5 max-h-[170px] overflow-y-auto">
      <div className="ios-secondary text-[11px] text-center font-medium">Today {timeLabel}</div>
      <IOSBubble side="received" tail={!sent}>{received}</IOSBubble>
      {sent && (
        <>
          <IOSBubble side="sent">{sent}</IOSBubble>
          <div className="ios-secondary text-[11px] font-medium self-end pr-0.5">Delivered</div>
        </>
      )}
    </div>
  </div>
);
