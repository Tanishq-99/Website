---
title: Sheet Music
permalink: /about/
layout: page
excerpt: 
---

<div class="sheet-music-grid">
  {% for sheet in site.data.sheetmusic %}
  <div class="sheet-card">
    <img
      src="https://img.youtube.com/vi/{{ sheet.youtube }}/hqdefault.jpg"
      alt="Thumbnail for {{ sheet.title }}"
      style="width: 100%; border-radius: 6px; margin-bottom: 1rem;"
    />
    <h3>{{ sheet.title }}</h3>
    <a href="/assets/sheetmusic/{{ sheet.file }}" class="sheet-btn" download>Download PDF</a>
    <a href="https://www.youtube.com/watch?v={{ sheet.youtube }}" target="_blank" class="sheet-yt">Watch on YouTube</a>
  </div>
  {% endfor %}
</div>
