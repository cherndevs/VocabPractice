# Spelling Pro - PWA Spelling Practice Application

## Overview

Spelling Pro is a Progressive Web Application (PWA) designed as a mobile-first spelling practice tool specifically optimized for iPhone. The application enables users to capture images of spelling worksheets using their device camera, extract text using OCR (Optical Character Recognition), and create interactive spelling practice sessions. The app features both practice and test modes with audio playback capabilities for enhanced learning.

The application follows a camera-to-practice workflow: users photograph spelling worksheets, the app processes the images to extract individual words, users can edit and curate the word list, and finally engage in structured spelling practice sessions with customizable audio feedback and timing controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application uses a modern React-based architecture with TypeScript for type safety. The UI is built using:
- **React 18** with functional components and hooks for state management
- **Wouter** for lightweight client-side routing instead of React Router
- **Tailwind CSS** with shadcn/ui components for consistent, mobile-optimized styling
- **TanStack Query** for server state management and caching
- **Radix UI** primitives for accessible, unstyled UI components

The application is structured as a single-page application with bottom navigation, designed specifically for mobile viewport constraints. Key architectural decisions include using a mobile-first responsive design with a maximum container width optimized for iPhone screens.

### Backend Architecture
The backend follows a RESTful API design using:
- **Express.js** server with TypeScript for the runtime environment
- **In-memory storage** as the primary data persistence layer (MemStorage class)
- **Modular route handling** with separation of concerns between API routes and business logic
- **Middleware-based request/response logging** for development debugging

The backend is designed to be stateless and lightweight, suitable for development and prototyping without requiring external database dependencies.

### Data Storage Solutions
The application uses a hybrid storage approach:
- **In-memory storage** for session data, user settings, and application state during development
- **Drizzle ORM** configured for PostgreSQL dialect for future database integration
- **LocalStorage** for client-side persistence of user preferences and offline capabilities
- **Database schema** designed for sessions (spelling practice data), settings (user preferences), and users (future authentication)

### Authentication and Authorization
Currently implements a minimal authentication structure with user schema definition but no active authentication middleware. The application is designed to support future authentication implementation without requiring architectural changes.

### PWA Implementation
The application implements Progressive Web App features including:
- **Service Worker** registration for offline functionality and caching
- **Web App Manifest** for installable app behavior on mobile devices
- **Camera API integration** for capturing worksheet images
- **Web Speech API** for text-to-speech functionality during spelling practice
- **Notification API** for practice reminders and session updates

### OCR and Speech Processing
The application integrates client-side processing libraries:
- **Tesseract.js** for optical character recognition to extract text from captured images
- **Web Speech Synthesis API** for audio playback of spelling words with customizable speech parameters
- **Camera API** with environment-facing camera preference for optimal document capture

### State Management Pattern
The application uses a combination of:
- **React Query** for server state, caching, and synchronization
- **React useState/useEffect** for local component state
- **Custom hooks** for reusable stateful logic (camera, OCR, speech synthesis)
- **Context API** for theme management and global UI state

## External Dependencies

### Core Framework Dependencies
- **@tanstack/react-query** - Server state management and caching layer
- **wouter** - Lightweight client-side routing
- **drizzle-orm** - Database ORM for PostgreSQL integration
- **express** - Node.js web framework for API server

### UI and Styling Dependencies
- **@radix-ui/** components - Accessible, unstyled UI primitives
- **tailwindcss** - Utility-first CSS framework
- **class-variance-authority** - Type-safe variant API for component styling
- **lucide-react** - Icon library for consistent iconography

### PWA and Device Integration
- **tesseract.js** - Client-side OCR for text extraction from images
- **Web APIs** - Camera, Speech Synthesis, Service Workers, Notifications (no external dependencies)

### Database Integration (Configured but Optional)
- **@neondatabase/serverless** - PostgreSQL serverless database driver
- **drizzle-kit** - Database migration and management tools
- **connect-pg-simple** - PostgreSQL session store for Express

### Development and Build Tools
- **vite** - Build tool and development server
- **typescript** - Type checking and compilation
- **esbuild** - Fast JavaScript bundler for production builds
- **tsx** - TypeScript execution for development server

The application is designed to work without external service dependencies during development, using in-memory storage and client-side processing. Database integration is optional and configured for easy deployment to platforms like Neon or other PostgreSQL providers.