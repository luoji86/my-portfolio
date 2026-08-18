(function () {
  "use strict";

  var NAV_HEIGHT = 84;
  var MAX_TILT = 6;
  var root = document.documentElement;
  var progressFill = null;
  var scoreValue = null;
  var nameNode = null;
  var headingNodes = [];
  var ticking = false;
  var cursorEl = null;
  var cursorRaf = 0;
  var cursorX = -100;
  var cursorY = -100;
  var cursorHot = false;

  function padScore(value) {
    return String(value).padStart(5, "0");
  }

  function updateVisibleHeadings() {
    var viewportHeight = window.innerHeight || 0;
    headingNodes.forEach(function (item) {
      if (!item.node) {
        return;
      }
      var rect = item.node.getBoundingClientRect();
      var isVisible = rect.top < viewportHeight * 0.82 && rect.bottom > viewportHeight * 0.15;
      item.node.classList.toggle("is-visible", isVisible);
    });
  }

  function updateScrollEffects() {
    var scrollTop = window.scrollY || root.scrollTop || 0;
    var docHeight = Math.max(root.scrollHeight, document.body.scrollHeight) - window.innerHeight;
    var progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;

    if (progressFill) {
      progressFill.style.transform = "scaleX(" + progress + ")";
    }

    if (scoreValue) {
      scoreValue.textContent = padScore(Math.floor(scrollTop / 10));
    }

    if (nameNode) {
      if (window.innerWidth > 700) {
        nameNode.style.transform = "translate3d(0, " + scrollTop * 0.2 + "px, 0)";
      } else {
        nameNode.style.transform = "";
      }
    }

    updateVisibleHeadings();
    ticking = false;
  }

  function requestUpdate() {
    if (ticking) {
      return;
    }
    ticking = true;
    window.requestAnimationFrame(updateScrollEffects);
  }

  function setupReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window) || items.length === 0) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }
    );

    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  function setupSmoothOffset() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener("click", function (event) {
        var href = anchor.getAttribute("href");
        if (!href || href === "#") {
          return;
        }
        var target = document.querySelector(href);
        if (!target) {
          return;
        }
        event.preventDefault();
        var rect = target.getBoundingClientRect();
        var top = rect.top + window.scrollY - NAV_HEIGHT;
        window.scrollTo({ top: top, behavior: "smooth" });
        history.replaceState(null, "", href);
      });
    });
  }

  function assignStagger(groupSelector, childSelector, step, startDelay) {
    var groups = Array.prototype.slice.call(document.querySelectorAll(groupSelector));
    groups.forEach(function (group) {
      var children = Array.prototype.slice.call(group.querySelectorAll(childSelector));
      children.forEach(function (child, index) {
        var delay = startDelay + index * step;
        child.setAttribute("data-delay", String(delay));
        child.style.setProperty("--delay", delay + "ms");
      });
    });
  }

  function setupStaggeredDelays() {
    assignStagger(".project-grid", ".project-card", 120, 0);
    assignStagger(".skill-grid", ".skill-card", 100, 0);
    assignStagger(".sticker-row", ".sticker", 100, 0);
  }

  function setupScrollSystems() {
    progressFill = document.querySelector(".scroll-progress span");
    scoreValue = document.querySelector(".scoreboard span");
    nameNode = document.querySelector(".hero h1");
    if (nameNode) {
      nameNode.style.willChange = "transform";
    }
    headingNodes = Array.prototype.slice.call(document.querySelectorAll(".section-heading h2")).map(function (node) {
      return { node: node };
    });

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    requestUpdate();
  }

  function setupCardTilt() {
    var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (prefersReducedMotion || !hasFinePointer) {
      return;
    }

    var cards = Array.prototype.slice.call(document.querySelectorAll(".project-card"));

    cards.forEach(function (card) {
      var rect = null;
      var active = false;

      function resetTilt() {
        active = false;
        card.classList.remove("is-tilting");
        card.style.transform = "";
      }

      function updateRect() {
        rect = card.getBoundingClientRect();
      }

      card.addEventListener("mouseenter", function () {
        active = true;
        card.classList.add("is-tilting");
        updateRect();
      });

      card.addEventListener("mousemove", function (e) {
        if (!active) {
          return;
        }
        if (!rect) {
          updateRect();
        }

        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = (e.clientX - cx) / (rect.width / 2);
        var dy = (e.clientY - cy) / (rect.height / 2);
        var tiltY = Math.max(-MAX_TILT, Math.min(MAX_TILT, dx * MAX_TILT));
        var tiltX = Math.max(-MAX_TILT, Math.min(MAX_TILT, -dy * MAX_TILT));

        card.style.transform =
          "rotateY(" + tiltY.toFixed(2) + "deg) rotateX(" + tiltX.toFixed(2) + "deg) translate(-2px, -3px)";
      });

      card.addEventListener("mouseleave", resetTilt);
      card.addEventListener("blur", resetTilt, true);
      card.addEventListener("mouseenter", updateRect);
      window.addEventListener("resize", updateRect);
    });
  }

  function setupArcadeCursor() {
    var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    cursorEl = document.querySelector(".arcade-cursor");

    if (!cursorEl || prefersReducedMotion || !hasFinePointer) {
      return;
    }

    document.documentElement.classList.add("is-fine-pointer");

    function renderCursor() {
      cursorRaf = 0;
      cursorEl.style.setProperty("--x", cursorX + "px");
      cursorEl.style.setProperty("--y", cursorY + "px");
      cursorEl.classList.add("is-active");
      if (cursorHot) {
        cursorEl.classList.add("is-hot");
      } else {
        cursorEl.classList.remove("is-hot");
      }
      cursorEl.style.transform = "translate3d(" + cursorX + "px, " + cursorY + "px, 0) scale(" + (cursorHot ? 1.2 : 1) + ")";
    }

    function scheduleCursor() {
      if (!cursorRaf) {
        cursorRaf = window.requestAnimationFrame(renderCursor);
      }
    }

    window.addEventListener(
      "mousemove",
      function (event) {
        cursorX = event.clientX;
        cursorY = event.clientY;
        scheduleCursor();
      },
      { passive: true }
    );

    window.addEventListener(
      "mousedown",
      function () {
        cursorHot = true;
        scheduleCursor();
      },
      { passive: true }
    );

    window.addEventListener(
      "mouseup",
      function () {
        cursorHot = false;
        scheduleCursor();
      },
      { passive: true }
    );

    document.addEventListener("mouseover", function (event) {
      cursorHot = Boolean(event.target.closest("a, button, .card-link, .nav a"));
      scheduleCursor();
    });

    document.addEventListener("mouseleave", function () {
      cursorEl.classList.remove("is-active");
    });

    window.addEventListener(
      "mouseenter",
      function () {
        cursorEl.classList.add("is-active");
      },
      { passive: true }
    );
  }

  function init() {
    setupStaggeredDelays();
    setupReveal();
    setupSmoothOffset();
    setupScrollSystems();
    setupCardTilt();
    setupArcadeCursor();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
