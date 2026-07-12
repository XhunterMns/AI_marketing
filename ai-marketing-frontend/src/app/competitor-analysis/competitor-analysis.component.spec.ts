import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompetitorAnalysisComponent } from './competitor-analysis.component';

describe('CompetitorAnalysisComponent', () => {
  let component: CompetitorAnalysisComponent;
  let fixture: ComponentFixture<CompetitorAnalysisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompetitorAnalysisComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CompetitorAnalysisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
