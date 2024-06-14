import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  constructor(private http: HttpClient) {}

  classifyEmail(text: string): Observable<any> {
    return this.http.post('http://localhost:3000/classify', { text });
  }
}
