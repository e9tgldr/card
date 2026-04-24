/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			cinzel: ['var(--font-display)'],
  			body: ['var(--font-prose)'],
  			playfair: ['var(--font-display)'],
  			cormorant: ['var(--font-prose)'],
  			display: ['var(--font-display)'],
  			prose: ['var(--font-prose)'],
  			meta: ['var(--font-meta)'],
  			bichig: ['var(--font-bichig)'],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius))',
  			sm: '0'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			/* legacy aliases, now pointing at the new codex palette */
  			crimson: 'var(--crimson)',
  			gold: 'var(--gold)',
  			/* new codex tokens */
  			ink: 'hsl(var(--ink))',
  			ivory: 'hsl(var(--ivory))',
  			'ivory-dim': 'hsl(var(--ivory-dim))',
  			seal: 'hsl(var(--seal))',
  			'seal-soft': 'hsl(var(--seal-soft))',
  			brass: 'hsl(var(--brass))',
  			'brass-deep': 'hsl(var(--brass-deep))',
  			lapis: 'hsl(var(--lapis))',
  			steppe: 'hsl(var(--steppe))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			'seal-pulse': {
  				'0%, 100%': { filter: 'drop-shadow(0 0 2px rgba(154,27,27,0.35))' },
  				'50%':      { filter: 'drop-shadow(0 0 10px rgba(154,27,27,0.70))' },
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'seal-pulse': 'seal-pulse 3.2s ease-in-out infinite',
  		}
  	}
  },
  safelist: [
    'bg-seal','bg-brass','bg-lapis','bg-ivory','bg-ink',
    'text-seal','text-brass','text-lapis','text-ivory',
    'border-seal','border-brass','border-lapis',
    /* legacy */
    'bg-crimson','bg-gold','text-crimson','text-gold','border-crimson','border-gold',
  ],
  plugins: [require("tailwindcss-animate")],
}
