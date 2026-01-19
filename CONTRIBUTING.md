# Contributing to CloudGrid

Thank you for your interest in contributing to CloudGrid! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all backgrounds and experience levels.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Git

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/cloud_grid.git
   cd cloud_grid
   ```

3. Install dependencies:
   ```bash
   npm install
   cd src/wasm && npm install && cd ../..
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

5. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Project Structure

```
cloud_grid/
├── src/
│   ├── app/          # React application
│   ├── wasm/         # WebAssembly (AssemblyScript)
│   └── styles/       # CSS styles
├── docs/             # Documentation
└── public/           # Static assets
```

### Making Changes

#### React Components

- Components are in `src/app/components/`
- Use TypeScript for type safety
- Follow existing code style and patterns
- Use shadcn/ui components where appropriate

#### WASM Module

- AssemblyScript source is in `src/wasm/assembly/`
- Build with `npm run build:wasm`
- Test WASM changes by restarting the dev server

#### Styling

- Use Tailwind CSS utility classes
- Custom styles go in `src/styles/main.css`
- Follow the existing color scheme (green/dark theme)

### Code Style

- Use TypeScript strict mode
- Follow existing naming conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small

### Testing Changes

1. Test in Chrome, Firefox, and Safari
2. Test at different zoom levels
3. Test with many items (2000+)
4. Check for memory leaks with DevTools
5. Verify mobile/touch interactions

## Submitting Changes

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add rubber band selection for multi-select
fix: preserve relative positions when moving groups
docs: update WASM API documentation
perf: optimize viewport culling for large datasets
```

Prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `perf:` - Performance improvement
- `refactor:` - Code refactoring
- `style:` - Code style changes
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### Pull Request Process

1. Ensure your code builds without errors:
   ```bash
   npm run build
   ```

2. Update documentation if needed

3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Create a Pull Request on GitHub:
   - Use a clear, descriptive title
   - Describe what changes you made and why
   - Reference any related issues
   - Include screenshots/GIFs for UI changes

5. Wait for review and address feedback

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Self-reviewed the code
- [ ] Added/updated documentation
- [ ] Tested on multiple browsers
- [ ] No console errors or warnings
- [ ] Performance is acceptable

## Reporting Issues

### Bug Reports

Include:
- Browser and OS version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/videos if applicable
- Console errors if any

### Feature Requests

Include:
- Clear description of the feature
- Use case / why it's needed
- Possible implementation approach
- Mockups/wireframes if applicable

## Areas for Contribution

### Good First Issues

- UI/UX improvements
- Documentation updates
- Bug fixes
- Code cleanup

### Advanced Contributions

- WASM performance optimizations
- New canvas tools
- Multi-user collaboration
- Plugin system
- Mobile optimizations

## Questions?

- Open a GitHub Discussion for questions
- Check existing issues and discussions first
- Be patient - maintainers are volunteers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
