# CorpCore ERP - Enterprise Resource Planning Platform

A modern, full-featured ERP SaaS application built with Next.js 14, Framer Motion, and Zustand for real-time project and task management.

## Features

### 🏠 Marketing Homepage
- Hero section with compelling value proposition
- Features showcase with icons and descriptions
- Pricing tiers with plan comparisons
- CTA buttons and company footer

### 📊 Dashboard
- KPI cards with real-time metrics
- Project overview and quick stats
- Team productivity insights
- Response animation and smooth transitions

### 📋 Project Management
- **List View**: Table with sorting and filtering
- **Kanban Board**: Drag-and-drop task management
- **Gantt Chart**: Timeline visualization with zoom
- **Timeline View**: Chronological task organization

### ✅ Task Management
- Task creation and editing
- Subtasks support
- Comments and collaboration
- File attachments
- Time tracking integration
- Priority and status management
- Due date tracking

### 🎨 Design System
- Custom color tokens (Primary: #042C53, Accent: #185FA5)
- Dark/light mode with localStorage persistence
- Responsive design (mobile-first approach)
- Glassmorphism UI elements
- Smooth animations with Framer Motion

### 📱 Responsive Features
- Desktop sidebar navigation
- Mobile bottom navigation
- Adaptive layout for all screen sizes
- Touch-friendly interactions

### ⚡ Technical Highlights
- Server-side rendering (SSC) with Next.js 14
- State management with Zustand
- Real-time animations with Framer Motion
- Drag-and-drop with dnd-kit
- Type-safe with TypeScript
- PWA support (installable app)
- Dark mode toggle

## Project Structure

```
app/
├── (public)/           # Marketing pages
│   ├── page.tsx       # Homepage
│   └── layout.tsx     # Public layout
├── (tenant)/          # Protected ERP routes
│   ├── dashboard/     # Main dashboard
│   ├── projects/      # Project management
│   │   ├── page.tsx   # Projects list
│   │   └── [id]/      # Project detail with views
│   └── layout.tsx     # Tenant layout with sidebar
├── layout.tsx         # Root layout
└── page.tsx          # Root redirect

components/
├── sidebar.tsx        # Main navigation sidebar
├── topbar.tsx         # Header with search & theme
├── bottom-nav.tsx     # Mobile navigation
├── kanban-board.tsx   # Kanban view component
├── task-list.tsx      # Table view component
├── gantt-chart.tsx    # Gantt chart component
├── timeline-view.tsx  # Timeline view component
├── task-panel.tsx     # Task details panel
├── kpi-card.tsx       # Dashboard KPI card
├── empty-state.tsx    # Empty state component
├── theme-toggle.tsx   # Dark mode toggle
├── toast-notification.tsx # Toast notifications
└── ui/                # shadcn/ui components

lib/
├── types.ts          # TypeScript type definitions
├── store.ts          # Zustand stores & mock data
└── utils-ui.ts       # UI utility functions

public/
└── manifest.json     # PWA manifest
```

## Getting Started

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
pnpm build
pnpm start
```

## Key Technologies

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS v4 with custom tokens
- **Animations**: Framer Motion
- **State**: Zustand
- **Drag & Drop**: dnd-kit
- **Components**: shadcn/ui
- **UI Icons**: Lucide React
- **Date Handling**: date-fns
- **Type Safety**: TypeScript

## Mock Data

The application comes with comprehensive mock data for:
- 3 sample projects with various tasks
- Multiple team members
- Real-time status and progress tracking
- Sample comments and attachments

All data is managed through Zustand stores in `/lib/store.ts`.

## Features Roadmap

- [ ] Backend API integration (Supabase/Firebase)
- [ ] User authentication and authorization
- [ ] Real-time collaboration (WebSockets)
- [ ] File upload and storage integration
- [ ] Advanced filtering and search
- [ ] Custom workflows and automation
- [ ] Budget and resource tracking
- [ ] Export to PDF/Excel
- [ ] Mobile app (React Native)

## Dark Mode

The application includes a built-in dark mode toggle in the topbar. Preferences are persisted to localStorage.

## PWA Support

The application is configured as a Progressive Web App and can be installed on mobile devices and desktops for offline support.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Optimized bundle size (~180KB gzipped)
- Lazy loading for route segments
- Image optimization
- CSS-in-JS with Tailwind
- TypeScript for better performance and DX

## Contributing

This is a v0 generated project. For modifications and enhancements, please refer to the component documentation in each file.

## License

MIT
