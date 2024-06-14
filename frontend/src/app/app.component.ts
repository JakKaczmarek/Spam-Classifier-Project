import { Component, OnInit } from '@angular/core';
import { EmailService } from './email.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  emailText: string = '';
  classification: string = '';
  metrics: any = null;

  constructor(private emailService: EmailService) {}

  ngOnInit() {}

  classifyEmail() {
    if (this.emailText === '') {
      return;
    }
    this.emailService.classifyEmail(this.emailText).subscribe(
      (data) => {
        this.classification = data.classification;
        this.metrics = data.metrics;
      },
      (error) => {
        console.error('Error:', error);
      }
    );
  }
}
