import { Component, Input, signal, OnInit, OnDestroy } from '@angular/core';
import { NgClass } from '@angular/common';

interface ThinkingStep {
  label: string;
  done: boolean;
}

@Component({
  selector: 'app-ai-thinking-loader',
  standalone: true,
  imports: [NgClass],
  templateUrl: './ai-thinking-loader.component.html',
  styleUrl: './ai-thinking-loader.component.scss',
})
export class AiThinkingLoaderComponent implements OnInit, OnDestroy {
  @Input() estimatedSeconds = 45;

  readonly steps = signal<ThinkingStep[]>([
    { label: 'Understanding your business', done: false },
    { label: 'Researching your audience', done: false },
    { label: 'Building campaign strategy', done: false },
    { label: 'Writing social posts', done: false },
    { label: 'Optimizing engagement', done: false },
  ]);

  readonly progress = signal(0);
  readonly remaining = signal(this.estimatedSeconds);

  private intervalId?: ReturnType<typeof setInterval>;
  private stepIndex = 0;

  ngOnInit(): void {
    this.remaining.set(this.estimatedSeconds);
    this.intervalId = setInterval(() => {
      this.remaining.update((r) => Math.max(0, r - 1));
      this.progress.update((p) => Math.min(95, p + 2));

      if (this.stepIndex < this.steps().length && this.progress() > (this.stepIndex + 1) * 18) {
        this.steps.update((steps) =>
          steps.map((s, i) => (i === this.stepIndex ? { ...s, done: true } : s))
        );
        this.stepIndex++;
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
