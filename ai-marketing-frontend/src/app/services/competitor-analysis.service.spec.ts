import { TestBed } from '@angular/core/testing';

import { CompetitorAnalysisService } from './competitor-analysis.service';

describe('CompetitorAnalysisService', () => {
  let service: CompetitorAnalysisService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompetitorAnalysisService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
