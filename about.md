---
title: Sheet Music
permalink: /about/
layout: page
excerpt: 
---

<!-- Filter Buttons -->
<div class="filter-buttons">
  <button class="filter-btn active" onclick="filterSheets('all', this)">All</button>
  <button class="filter-btn" onclick="filterSheets('composed', this)">Composed</button>
  <button class="filter-btn" onclick="filterSheets('transcription', this)">Transcription</button>
</div>

<!-- Sheet Music Grid -->
<div class="sheet-music-grid">
  {% for sheet in site.data.sheetmusic %}
    {% assign yt_id = sheet.youtube | split: 'v=' | last %}
    <div class="sheet-card" data-filter="{{ sheet.filter }}">
      <img
        src="https://img.youtube.com/vi/{{ yt_id }}/hqdefault.jpg"
        alt="Thumbnail for {{ sheet.title }}"
        class="sheet-thumbnail"
      />
      <h3>{{ sheet.title }}</h3>
      <div class="sheet-buttons">
        <a href="/assets/sheetmusic/{{ sheet.file }}" class="sheet-btn" download>Download PDF</a>
        <a href="{{ sheet.youtube }}" target="_blank" class="sheet-yt">Watch on YouTube</a>
      </div>
    </div>
  {% endfor %}
</div>

<!-- Filtering Script -->
<script>
  function filterSheets(type, btn) {
    const cards = document.querySelectorAll('.sheet-card');
    const buttons = document.querySelectorAll('.filter-btn');

    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    cards.forEach(card => {
      const filter = card.getAttribute('data-filter');
      card.style.display = (type === 'all' || filter === type) ? '' : 'none';
    });
  }
</script>
