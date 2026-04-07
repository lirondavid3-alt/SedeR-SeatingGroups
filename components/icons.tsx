import React from 'react';

interface IconProps {
    className?: string;
    title?: string;
}

export const DoorIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M6 3a1 1 0 011-1h6a1 1 0 011 1v14a1 1 0 01-1 1H7a1 1 0 01-1-1V3zm2 9a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
    </svg>
);

export const WindowIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V5zm2 2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H6a1 1 0 01-1-1V7zm6 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V7zm-6 6a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H6a1 1 0 01-1-1v-2zm6 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2z" clipRule="evenodd" />
    </svg>
);

export const UserIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
);

export const PlusIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
);

export const TrashIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);

export const PencilIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
);

export const ShuffleIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
);

export const PrintIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

export const BookIcon: React.FC<IconProps> = ({ className = 'h-4 w-4' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        <path fillRule="evenodd" d="M2 5a3 3 0 013-3h10a3 3 0 013 3v10a3 3 0 01-3-3H5a3 3 0 01-3-3V5zm3.5 1.5a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h8a.5.5 0 00.5-.5v-8a.5.5 0 00-.5-.5h-8z" clipRule="evenodd" />
        <path d="M10.5 6a.5.5 0 00-1 0v3.5H6a.5.5 0 000 1h3.5V14a.5.5 0 001 0v-3.5H14a.5.5 0 000-1h-3.5V6z" />
        <path fillRule="evenodd" d="M9.879 2.47a.75.75 0 01.75 0l6 3.5a.75.75 0 010 1.312l-6 3.5a.75.75 0 01-.75 0l-6-3.5a.75.75 0 010-1.312l6-3.5zM3.523 7.69a.75.75 0 01-.273-1.023l6-10.5a.75.75 0 011.299.746l-6 10.5a.75.75 0 01-1.026.277zM15.75 16.5a.75.75 0 01-1.5 0V8.924l-6-3.5V16.5a.75.75 0 01-1.5 0V5.25a.75.75 0 01.75-.75h.001l7.5 4.375a.75.75 0 010 1.312L9.25 14.53V16.5a.75.75 0 001.5 0v-2.08a.75.75 0 01.44-.685l5.25-2.5a.75.75 0 01.31.935V16.5z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v.518l5.973 2.56a.75.75 0 01.527.92l-1.5 5.25a.75.75 0 01-1.448-.414l1.206-4.22L10 4.56v11.69l4.722-2.024a.75.75 0 01.956.41l1.5 4.5a.75.75 0 01-1.41.472L15 17.653l-4.25 1.821a.75.75 0 01-.5 0L6 17.653l-1.722 1.292a.75.75 0 01-1.41-.472l1.5-4.5a.75.75 0 01.956-.41L9.25 16.25V4.56L3.294 6.614l1.206 4.22a.75.75 0 01-1.448.414l-1.5-5.25a.75.75 0 01.527-.92L8.25 3.268V2.75A.75.75 0 019 2h1z" clipRule="evenodd" />
    </svg>
);

export const SparklesIcon: React.FC<IconProps> = ({ className = 'h-4 w-4' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10.868 2.884c.321.64.321 1.415 0 2.055l-1.74 3.48a1.5 1.5 0 102.923 1.462l1.74-3.48c.321-.64.321-1.415 0-2.055a.75.75 0 00-1.447.732l-.585 1.17a.06.06 0 01-.117 0l-.585-1.17a.75.75 0 00-1.447-.732zM8.583 6.336a.75.75 0 00-1.06 1.06l1.06-1.06zM7.523 7.396l1.06 1.06a.75.75 0 101.06-1.06l-1.06 1.06zM5.232 4.41a.75.75 0 011.06 1.06l-3.535 3.536a.75.75 0 01-1.06-1.06l3.535-3.536zM9.637 11.232a.75.75 0 00-1.06-1.06l-1.06 1.06a.75.75 0 101.06 1.06l1.06-1.06zM12.9 14.336a.75.75 0 10-1.06 1.06l1.06-1.06zM11.84 15.396a.75.75 0 101.06-1.06l-1.06 1.06zM15.132 12.41a.75.75 0 011.06 1.06l-3.535 3.536a.75.75 0 11-1.06-1.06l3.535-3.536z" clipRule="evenodd" />
    </svg>
);

export const MaleIcon: React.FC<IconProps> = ({ className = 'h-5 w-5', title }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        {title && <title>{title}</title>}
        <circle cx="10" cy="14" r="4" />
        <line x1="13" y1="11" x2="18" y2="6" />
        <polyline points="18 10 18 6 14 6" />
    </svg>
);

export const FemaleIcon: React.FC<IconProps> = ({ className = 'h-5 w-5', title }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        {title && <title>{title}</title>}
        <circle cx="12" cy="10" r="4" />
        <line x1="12" y1="14" x2="12" y2="20" />
        <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

export const XIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const DuplicateIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

export const PinIcon: React.FC<IconProps> = ({ className = 'h-5 w-5', title }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9c-.39.2-.13.75.31.75h11.16c.44 0 .7-.55.31-.75l-1.78-.9a2 2 0 0 1-1.11-1.79V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2Z" />
    </svg>
);

export const SwitchHorizontalIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
);

export const NoPreferenceIcon: React.FC<IconProps> = ({ className = 'h-8 w-8' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const BalancedIcon: React.FC<IconProps> = ({ className = 'h-8 w-8' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" />
    </svg>
);

export const PairingIcon: React.FC<IconProps> = ({ className = 'h-8 w-8' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75M13.5 10.5m0 0v3.75m0-3.75h3.75m-3.75 0H10.5m3.75 0v3.75m0-3.75h-3.75m3.75 0a4.5 4.5 0 014.5 4.5v3.75a4.5 4.5 0 01-9 0v-3.75a4.5 4.5 0 014.5-4.5z" />
    </svg>
);

export const EdgesIcon: React.FC<IconProps> = ({ className = 'h-8 w-8' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
    </svg>
);

export const ShareIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
);

export const BellIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

export const SendIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

export const PdfIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} pointer-events-none`} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none">
        <path d="M19.5 21L4.5 21C3.67157 21 3 20.3284 3 19.5L3 4.5C3 3.67157 3.67157 3 4.5 3L14.25 3L21 9.75L21 19.5C21 20.3284 20.3284 21 19.5 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14.25 3L14.25 9.75L21 9.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7.5 14.25L7.5 18.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7.5 14.25H9C9.82843 14.25 10.5 14.9216 10.5 15.75V15.75C10.5 16.5784 9.82843 17.25 9 17.25H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 18.75L12 14.25L13.5 18.75L15 14.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16.5 14.25H18.75V18.75H16.5V14.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16.5 16.5H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

export const ShieldCheckIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

export const SchoolIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
    </svg>
);

export const UserPlusIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);

export const CameraIcon: React.FC<IconProps> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);
