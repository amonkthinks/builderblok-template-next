/** As BuilderBlok stores them on a block — see `interactions` in `builderblok/pages/*.json`. */
export type Interaction = {
    id: string;
    trigger: 'load' | 'scroll' | 'click' | 'hover';
    effect: 'fade' | 'from-bottom' | 'from-top' | 'from-left' | 'from-right' | 'zoom-in' | 'zoom-out';
    target: string;
    duration: number;
    delay: number;
    easing: string;
    distance: number;
    once: boolean;
    startHidden: boolean;
};

type LayoutBlock = { id: string; interactions?: Interaction[] };

/**
 * Interactions as the page runs them: the element that triggers (`source`)
 * and everything the builder stored about what happens.
 *
 * A copy of BuilderBlok's builder runtime (`2-web/src/utils/build/interactionRuntime.ts`),
 * so Preview and this site animate identically — change both.
 */
export type RuntimeInteraction = Interaction & { source: string };

export function runtimeInteractions(blocks: Pick<LayoutBlock, 'id' | 'interactions'>[]): RuntimeInteraction[] {
    const ids = new Set(blocks.map((block) => block.id));

    return blocks.flatMap((block) =>
        (block.interactions ?? [])
            /* a click or hover with no target, or one whose target was deleted, does nothing */
            .filter((ix) => (ix.target ? ids.has(ix.target) : ix.trigger === 'load' || ix.trigger === 'scroll'))
            .map((ix) => ({ ...ix, source: block.id })),
    );
}

/** Elements that start hidden, so the first paint does not flash them before the runtime runs. */
export function hiddenAtStart(list: RuntimeInteraction[]): string[] {
    return list
        .filter((ix) => ix.trigger === 'load' || ix.trigger === 'scroll' || ix.startHidden)
        .map((ix) => ix.target || ix.source);
}

/** CSS that keeps those elements invisible until the runtime has taken them over. */
export const hideUntilReady = (ids: string[]) =>
    ids.map((id) => `html.bb-js .bb-${id.replace(/[^a-zA-Z0-9_-]/g, '')}:not(.bb-ix-ready){opacity:0}`).join('');

/**
 * Serialised with `String(fn)` into the page, so it may use nothing from
 * outside its own body — no imports, no helpers.
 */
export function interactionRuntime(list: RuntimeInteraction[]) {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const find = (id: string) => document.querySelector<HTMLElement>(`.bb-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`);

    /* several interactions can drive one element — a menu's open and close
       buttons — so whether it is shown, and its own transform, belong to it */
    const shownOf = new Map<HTMLElement, boolean>();
    const baseOf = new Map<HTMLElement, string>();

    const offset = (ix: RuntimeInteraction) => {
        const d = `${ix.distance}px`;

        switch (ix.effect) {
            case 'from-bottom': return `translateY(${d})`;
            case 'from-top': return `translateY(-${d})`;
            case 'from-left': return `translateX(-${d})`;
            case 'from-right': return `translateX(${d})`;
            case 'zoom-in': return 'scale(0.9)';
            case 'zoom-out': return 'scale(1.1)';
            default: return '';
        }
    };

    list.forEach((ix) => {
        const source = find(ix.source);
        const target = ix.target ? find(ix.target) : source;

        if (!source || !target) return;

        /* the element's own transform (a centring translate, say) stays under the offset —
           read before any interaction has moved it */
        if (!baseOf.has(target)) baseOf.set(target, getComputedStyle(target).transform);
        const base = baseOf.get(target)!;
        const hiddenTransform = `${offset(ix)} ${base === 'none' ? '' : base}`.trim();
        const toggles = ix.trigger === 'click' || ix.trigger === 'hover';

        const duration = reduce ? 0 : ix.duration;
        let settle = 0;

        const apply = (shown: boolean, animate: boolean) => {
            const delay = shown ? ix.delay : 0;
            const timing = `${duration}ms ${ix.easing} ${delay}ms`;

            /* visibility flips at the end of a hide, so it fades out before it stops being clickable */
            target.style.transition = animate
                ? `opacity ${timing}, transform ${timing}, visibility 0s linear ${shown ? 0 : duration}ms`
                : 'none';
            target.style.opacity = shown ? '' : '0';
            target.style.transform = shown ? '' : hiddenTransform;
            target.style.visibility = shown || !toggles ? '' : 'hidden';
            target.style.pointerEvents = shown ? '' : 'none';

            /* hand the element's own transitions (hover colours and so on) back afterwards */
            clearTimeout(settle);
            if (animate) settle = window.setTimeout(() => (target.style.transition = ''), duration + delay + 50);
        };

        const initial = !(ix.trigger === 'load' || ix.trigger === 'scroll' || ix.startHidden);

        if (!initial) {
            shownOf.set(target, false);
            apply(false, false);
        } else if (!shownOf.has(target)) {
            shownOf.set(target, true);
        }

        target.classList.add('bb-ix-ready');

        if (ix.trigger === 'click') source.setAttribute('aria-expanded', String(shownOf.get(target)));

        const go = (next: boolean) => {
            if (next === shownOf.get(target)) return;

            shownOf.set(target, next);
            if (ix.trigger === 'click') source.setAttribute('aria-expanded', String(next));
            void target.offsetWidth; /* commit the start state, so the change animates */
            apply(next, true);
        };

        if (ix.trigger === 'load') {
            requestAnimationFrame(() => go(true));
        } else if (ix.trigger === 'scroll') {
            if (!('IntersectionObserver' in window)) return go(true);

            const observer = new IntersectionObserver(
                (entries) =>
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            go(true);
                            if (ix.once) observer.disconnect();
                        } else if (!ix.once) {
                            go(false);
                        }
                    }),
                { threshold: 0.15 },
            );

            /* the trigger is watched, not the target — a hidden target may sit off to one side */
            observer.observe(source);
        } else if (ix.trigger === 'click') {
            source.addEventListener('click', (event) => {
                if (source.tagName === 'A' && (source.getAttribute('href') ?? '#') === '#') event.preventDefault();

                go(!shownOf.get(target));
            });
            source.style.cursor ||= 'pointer';
        } else {
            /* moving from the trigger onto the target (a dropdown, say) keeps it open */
            const within = (node: EventTarget | null) => node instanceof Node && (source.contains(node) || target.contains(node));

            source.addEventListener('mouseenter', () => go(!initial));
            source.addEventListener('mouseleave', (event) => !within(event.relatedTarget) && go(initial));
            target.addEventListener('mouseleave', (event) => !within(event.relatedTarget) && go(initial));
        }
    });
}

/** The runtime and its data as one inline script. `<` is escaped so the data cannot end the tag. */
export const runtimeScript = (list: RuntimeInteraction[]) =>
    list.length ? `(${String(interactionRuntime)})(${JSON.stringify(list).replace(/</g, '\\u003c')});` : '';
