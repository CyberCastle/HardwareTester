import { async, ComponentFixture, TestBed } from '@angular/core/testing'

import { SSD1306Component } from './ssd1306.component'

describe('SSD1306Component', () => {
    let component: SSD1306Component
    let fixture: ComponentFixture<SSD1306Component>

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [SSD1306Component],
        }).compileComponents()
    }))

    beforeEach(() => {
        fixture = TestBed.createComponent(SSD1306Component)
        component = fixture.componentInstance
        fixture.detectChanges()
    })

    it('should create', () => {
        expect(component).toBeTruthy()
    })
})
