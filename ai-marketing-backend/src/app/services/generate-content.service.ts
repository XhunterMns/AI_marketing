import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class GenerateContentService {

  constructor(private http: HttpClient) { }
  baseUrl = 'http://localhost:3000';

  generatecontent(prompt: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/generate`, { prompt });
  }
}
