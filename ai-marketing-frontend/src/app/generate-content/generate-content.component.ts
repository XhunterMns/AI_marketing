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
  campaignId = '';

  constructor(
    private campaignService: CampaignService
  ) {}

  generateCampaign() {

    this.campaignService
      .generateCampaign(this.prompt)
      .subscribe({
        next: (res) => {
          const aiText = res?.response ?? res?.result;
          this.generatedText = typeof aiText === 'string' ? aiText : '';
          this.campaignId = res?.campaignId || '';
        },
        error: (err) => {
          console.error(err);
        }
      });

  }

  approveCampaign() {
    if (!this.campaignId) {
      console.error('No campaignId available');
      return;
    }

    this.campaignService
      .approveCampaign(this.campaignId)
      .subscribe({
        next: (res) => {
          console.log('Approved', res);
        },
        error: (err) => {
          console.error(err);
        }
      });
  }

  declineCampaign() {
    if (!this.campaignId) {
      console.error('No campaignId available');
      return;
    }

    this.campaignService
      .declineCampaign(this.campaignId)
      .subscribe({
        next: (res) => {
          console.log('Declined', res);
        },
        error: (err) => {
          console.error(err);
        }
      });
  }

  cancelCampaign() {
    if (!this.campaignId) {
      console.error('No campaignId available');
      return;
    }

    this.campaignService
      .cancelCampaign(this.campaignId)
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