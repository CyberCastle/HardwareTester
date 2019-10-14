import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { I2cDriverComponent } from './i2c-driver.component';

describe('I2cDriverComponent', () => {
  let component: I2cDriverComponent;
  let fixture: ComponentFixture<I2cDriverComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ I2cDriverComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(I2cDriverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
