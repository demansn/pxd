const sectionLinks = [...document.querySelectorAll("aside.sidebar a[href^='#']")];
const sectionTargets = sectionLinks
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);

const linkById = new Map();
for (const a of sectionLinks) linkById.set(a.getAttribute("href").slice(1), a);

const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const a of sectionLinks) a.classList.remove("active");
        const link = linkById.get(entry.target.id);
        if (link) link.classList.add("active");
    }
}, { rootMargin: "-30% 0% -60% 0%", threshold: 0 });

for (const t of sectionTargets) observer.observe(t);

document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLAnchorElement)) return;
    const href = target.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    const el = document.getElementById(href.slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", href);
});
