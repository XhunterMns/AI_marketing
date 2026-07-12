import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-result-section-card',
  standalone: true,
  imports: [NgClass],
  templateUrl: './result-section-card.component.html',
  styleUrl: './result-section-card.component.scss',
})
export class ResultSectionCardComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) icon = 'article';
  @Input() content = '';
  @Input() items: string[] = [];
  @Input() showTelegram = false;

  @Output() copy = new EventEmitter<void>();
  @Output() regenerate = new EventEmitter<void>();
  @Output() download = new EventEmitter<void>();
  @Output() sendTelegram = new EventEmitter<void>();

  readonly expanded = signal(true);

  toggleExpand(): void {
    this.expanded.update((v) => !v);
  }

  get displayText(): string {
    if (this.items.length) return this.items.join('\n');
    return this.content;
  }
}
