/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
        extend: {
                fontFamily: {
                        display: ['Oswald', '"Saira Condensed"', 'system-ui', 'sans-serif'],
                        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                },
                // Type scale (v2). Sizes pull from --text-* CSS vars. Tailwind's
                // default xs/sm/base are REMAPPED onto the tokens so the dev-reflex
                // `text-sm` lands on the system (values unchanged: 12/14/16px).
                fontSize: {
                        'display-2xl': ['var(--text-display-2xl)', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.02em' }],
                        'display-xl': ['var(--text-display-xl)', { lineHeight: '1.05', fontWeight: '700', letterSpacing: '-0.02em' }],
                        'display-lg': ['var(--text-display-lg)', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
                        'heading': ['var(--text-heading)', { lineHeight: '1.2', fontWeight: '600' }],
                        'subheading': ['var(--text-subheading)', { lineHeight: '1.3', fontWeight: '600' }],
                        'base': ['var(--text-body-lg)', { lineHeight: '1.5' }],
                        'body': ['var(--text-body)', { lineHeight: '1.5', fontWeight: '400' }],
                        'sm': ['var(--text-body)', { lineHeight: '1.5' }],
                        'body-strong': ['var(--text-body-strong)', { lineHeight: '1.5', fontWeight: '600' }],
                        'label': ['var(--text-label)', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.04em' }],
                        'xs': ['var(--text-caption)', { lineHeight: '1.4' }],
                        'caption': ['var(--text-caption)', { lineHeight: '1.4', fontWeight: '400' }],
                        'micro': ['var(--text-micro)', { lineHeight: '1.35', fontWeight: '500' }],
                        'score': ['var(--score-figure)', { lineHeight: '1', fontWeight: '700' }],
                        'score-lg': ['var(--score-figure-lg)', { lineHeight: '1', fontWeight: '700' }],
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)',
                        // v2: cards/panels/modals share --radius-lg; the default
                        // xl/2xl utilities remap so 60+ existing call sites snap
                        // to the token with no component edits.
                        xl: 'var(--radius-lg)',
                        '2xl': 'var(--radius-lg)',
                        '3xl': 'var(--radius-lg)',
                        // Named brand radii (reference the spec tokens directly)
                        'cvf-sm': 'var(--radius-sm)',
                        'cvf-md': 'var(--radius-md)',
                        'cvf-lg': 'var(--radius-lg)',
                        'cvf-full': 'var(--radius-full)'
                },
                colors: {
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
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
                        // ---- CVF brand tokens (reference the same CSS vars as var()) ----
                        surface: {
                                DEFAULT: 'var(--surface)',
                                raised: 'var(--surface-raised)',
                                sunken: 'var(--surface-sunken)'
                        },
                        'border-strong': 'var(--border-strong)',
                        ink: 'var(--cvf-ink)',
                        teal: {
                                DEFAULT: 'var(--cvf-teal)',
                                deep: 'var(--cvf-teal-deep)',
                                tint: 'var(--cvf-teal-tint)'
                        },
                        gold: {
                                DEFAULT: 'var(--cvf-gold)',
                                deep: 'var(--cvf-gold-deep)',
                                tint: 'var(--cvf-gold-tint)'
                        },
                        zia: {
                                DEFAULT: 'var(--cvf-zia)',
                                deep: 'var(--cvf-zia-deep)',
                                down: 'var(--cvf-zia-down)'
                        },
                        sport: {
                                kickball: 'var(--sport-kickball)',
                                'kickball-tint': 'var(--sport-kickball-tint)',
                                flag: 'var(--sport-flag)',
                                'flag-tint': 'var(--sport-flag-tint)',
                                'flag-deep': 'var(--sport-flag-deep)'
                        },
                        rank: {
                                silver: 'var(--rank-silver)',
                                bronze: 'var(--rank-bronze)'
                        },
                        'text-primary': 'var(--text-primary)',
                        'text-secondary': 'var(--text-secondary)',
                        'text-muted': 'var(--text-muted)',
                        'text-on-brand': 'var(--text-on-brand)',
                        win: 'var(--win)',
                        loss: 'var(--loss-text)',
                        leader: 'var(--leader)'
                },
                keyframes: {
                        'accordion-down': {
                                from: {
                                        height: '0'
                                },
                                to: {
                                        height: 'var(--radix-accordion-content-height)'
                                }
                        },
                        'accordion-up': {
                                from: {
                                        height: 'var(--radix-accordion-content-height)'
                                },
                                to: {
                                        height: '0'
                                }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                },
                boxShadow: {
                        // Brand elevation tokens
                        'sm': 'var(--shadow-sm)',
                        'md': 'var(--shadow-md)',
                        'lg': 'var(--shadow-lg)',
                        'floating': 'var(--shadow-floating)',
                        // Teal glow (re-tinted from the old cyan) for accent emphasis
                        'glow-cyan': '0 0 20px rgba(91,184,204,0.22), 0 4px 20px rgba(91,184,204,0.12)',
                        'glow-cyan-sm': '0 0 12px rgba(91,184,204,0.16)',
                        'card-hover': 'var(--shadow-md)',
                        'card': 'var(--shadow-sm)',
                },
        }
  },
  plugins: [require("tailwindcss-animate")],
};
