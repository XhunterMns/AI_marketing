import { TestBed } from '@angular/core/testing';

import { GenerateContentService } from './generate-content.service';

describe('GenerateContentService', () => {
  let service: GenerateContentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GenerateContentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
