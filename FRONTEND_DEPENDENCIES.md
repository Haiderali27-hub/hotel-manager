# 📦 Recommended Frontend Dependencies

Add these to your package.json for better development experience:

## UI Component Libraries (Choose One)
```bash
# Material-UI (Most popular)
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material

# OR Ant Design (Good for admin interfaces)
npm install antd @ant-design/icons

# OR Chakra UI (Simple and modern)
npm install @chakra-ui/react @chakra-ui/icons @emotion/react @emotion/styled framer-motion
```

## Form Handling
```bash
npm install react-hook-form @hookform/resolvers zod
```

## State Management
```bash
# Simple state management
npm install zustand

# OR Redux (if complex state needed)
npm install @reduxjs/toolkit react-redux
```

## Utilities
```bash
# Date handling
npm install date-fns

# Icons (if not using UI library icons)
npm install lucide-react

# Charts for dashboard
npm install recharts

# Notifications
npm install react-hot-toast
```

## Development Tools
```bash
# Better TypeScript experience
npm install -D @types/node

# CSS utilities
npm install clsx
```

## Complete Installation Command
```bash
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material react-hook-form @hookform/resolvers zod zustand date-fns recharts react-hot-toast clsx
```

## Example Usage After Installation

### Material-UI Setup
```tsx
// src/App.tsx
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    mode: 'light', // or 'dark'
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Your components */}
    </ThemeProvider>
  );
}
```

### Form with React Hook Form
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  dailyRate: z.number().min(0, 'Rate must be positive'),
});

type FormData = z.infer<typeof schema>;

const GuestForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    // Call your Tauri API
    invoke('add_guest', data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
};
```

Choose the dependencies that fit your design preferences and project complexity!
