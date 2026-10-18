# Jewoo Lee — Portfolio

My personal portfolio website, live at **[jewoolee.dev](https://www.jewoolee.dev)**.

It's a single-page site that introduces who I am and what I've built: an about section, my skills, projects, work experience, and a contact form. My CV is in [`public/files/JEWOOLEE_CV.pdf`](public/files/JEWOOLEE_CV.pdf).

## Tech stack

| Area | Tools |
| --- | --- |
| Framework | [React 19](https://react.dev/) + [Vite 6](https://vite.dev/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Animation | [GSAP](https://gsap.com/) (scroll animations) + [Lenis](https://lenis.darkroom.engineering/) (smooth scrolling) |
| Contact form | [Getform](https://getform.io/) |
| Hosting & analytics | [Vercel](https://vercel.com/) |

## Run it locally

**You need:** [Node.js](https://nodejs.org/) 18 or newer (20+ recommended) and [Git](https://git-scm.com/).

```bash
git clone https://github.com/jewoolee0502/jewoo-lee.git
cd jewoo-lee
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser. Changes to the code reload automatically.

## Available commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Serve the built `dist/` folder locally to check it before deploying |
| `npm run lint` | Check the code with ESLint |

## Project structure

```
├── index.html          # Page shell, fonts, favicon
├── public/
│   ├── files/          # CV (PDF)
│   └── images/         # Project screenshots and skill icons
└── src/
    ├── main.jsx        # Entry point (mounts the app + Vercel Analytics)
    ├── App.jsx         # Page layout and scroll animations
    ├── index.css       # Tailwind setup and global styles
    └── components/     # One file per section: Hero, About, Skill, Project, Experience, Contact, ...
```

To change the site's content, edit the matching file in `src/components/` — for example, projects are listed in `Project.jsx`.

## Contact

- Email: [jewoo.lee@mail.mcgill.ca](mailto:jewoo.lee@mail.mcgill.ca)
- LinkedIn: [linkedin.com/in/jewoo-lee](https://www.linkedin.com/in/jewoo-lee/)
- GitHub: [github.com/jewoolee0502](https://github.com/jewoolee0502)
- Instagram: [@jwuu_lee](https://www.instagram.com/jwuu_lee/)

## License

[Apache 2.0](LICENSE)
