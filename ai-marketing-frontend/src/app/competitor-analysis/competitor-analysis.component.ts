import { Component} from '@angular/core';
import { CompetitorAnalysisService } from '../services/competitor-analysis.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-competitor-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './competitor-analysis.component.html',
  styleUrls: ['./competitor-analysis.component.css']
})
export class CompetitorAnalysisComponent {


  prompt = '';
  generatedText = '';
  competitorData = '';

  constructor(private analysisService: CompetitorAnalysisService) {}

  analyzeCompetitors() {
   this.analysisService
      .competitorAnalysis(this.prompt)
      .subscribe({
        next: (res: { result: string; }) => {
          this.competitorData = typeof res?.result === 'string' ? res.result : String(res ?? '');
        },
        error: (err: any) => {
          console.error(err);
        }
      });
  }

}
