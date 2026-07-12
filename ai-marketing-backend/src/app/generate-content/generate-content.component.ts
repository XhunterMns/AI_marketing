import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { CampaignService } from '../services/campaign.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-generate-content',
  templateUrl: './generate-content.component.html',
  styleUrls: ['./generate-content.component.css'],
  imports: [FormsModule, CommonModule, HttpClientModule],
  standalone: true
})
export class GenerateContentComponent {

  prompt = '';

  generatedText = '';

  constructor(
    private campaignService: CampaignService
  ) {}

  generateCampaign() {

    this.campaignService
      .generateCampaign(this.prompt)
      .subscribe({
        next: (res) => {
          this.generatedText = typeof res?.result === 'string' ? res.result : String(res ?? '');
        },
        error: (err) => {
          console.error(err);
        }
      });

  }

  activateCampaign() {

    this.campaignService
      .activateCampaign('')
      .subscribe({
        next: (res) => {
          console.log('Activated', res);
        },
        error: (err) => {
          console.error(err);
        }
      });

  }

  cancelCampaign() {

    this.campaignService
      .cancelCampaign('')
      .subscribe({
        next: (res) => {
          console.log('Cancelled', res);
        },
        error: (err) => {
          console.error(err);
        }
      });

  }

}