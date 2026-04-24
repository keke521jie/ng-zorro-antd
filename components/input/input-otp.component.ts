/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { BACKSPACE, LEFT_ARROW, RIGHT_ARROW } from '@angular/cdk/keycodes';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
  viewChildren,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormArray,
  FormBuilder,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { tap } from 'rxjs/operators';

import { NzSafeAny, NzSizeLDSType, NzStatus, OnTouchedType } from 'ng-zorro-antd/core/types';

import { NzInputDirective } from './input.directive';

@Component({
  selector: 'nz-input-otp',
  exportAs: 'nzInputOtp',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (item of otpArray.controls; track $index) {
      <input
        nz-input
        class="ant-otp-input"
        type="text"
        maxlength="1"
        size="1"
        [nzSize]="nzSize()"
        [formControl]="item"
        [nzStatus]="nzStatus()"
        (input)="onInput($index, $event)"
        (focus)="onFocus($event)"
        (keydown)="onKeyDown($index, $event)"
        (paste)="onPaste($index, $event)"
        #otpInput
      />
    }
  `,
  host: {
    class: 'ant-otp'
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NzInputOtpComponent),
      multi: true
    }
  ],
  imports: [NzInputDirective, ReactiveFormsModule]
})
export class NzInputOtpComponent implements ControlValueAccessor {
  private formBuilder = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  readonly otpInputs = viewChildren<ElementRef<HTMLInputElement>>('otpInput');

  readonly nzLength = input(6, { transform: numberAttribute });
  readonly nzSize = input<NzSizeLDSType>('default');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly nzStatus = input<NzStatus>('');
  readonly nzFormatter = input<(value: string) => string>(value => value);
  readonly nzMask = input<string | null>(null);

  protected otpArray!: FormArray<FormControl<string>>;
  private readonly internalValue = signal<string[]>([]);
  private onChangeCallback?: (_: NzSafeAny) => void;
  onTouched: OnTouchedType = () => {};

  constructor() {
    this.createFormArray();

    effect(() => {
      const length = this.nzLength();
      untracked(() => {
        if (this.otpArray.length !== length) {
          this.createFormArray();
        }
      });
    });

    effect(() => {
      this.setDisabledState(this.disabled());
    });
  }

  onInput(index: number, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const nextInput = this.otpInputs()[index + 1];

    if (inputElement.value && nextInput) {
      nextInput.nativeElement.focus();
    } else if (!nextInput) {
      this.selectInputBox(index);
    }
  }

  onFocus(event: FocusEvent): void {
    const inputElement = event.target as HTMLInputElement;
    inputElement.select();
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    const previousInput = this.otpInputs()[index - 1];

    if (event.keyCode === BACKSPACE) {
      event.preventDefault();

      this.internalValue.update(v => {
        const copy = [...v];
        copy[index] = '';
        return copy;
      });
      this.otpArray.at(index).setValue('', { emitEvent: false });

      if (previousInput) {
        this.selectInputBox(index - 1);
      }

      this.emitValue();
    } else if (event.keyCode === LEFT_ARROW) {
      event.preventDefault();
      this.selectInputBox(index - 1);
    } else if (event.keyCode === RIGHT_ARROW) {
      event.preventDefault();
      this.selectInputBox(index + 1);
    }
  }

  writeValue(value: string): void {
    if (!value) {
      this.internalValue.set(new Array(this.nzLength()).fill(''));
      this.otpArray.reset();
      return;
    }

    const chars = value.split('');
    const formatter = this.nzFormatter();
    const mask = this.nzMask();

    this.internalValue.set(chars);
    chars.forEach((val, i) => {
      const displayValue = mask ? mask : formatter(val);
      this.otpArray.at(i).setValue(displayValue, { emitEvent: false });
    });
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: () => {}): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.otpArray.disable();
    } else {
      this.otpArray.enable();
    }
  }

  onPaste(index: number, event: ClipboardEvent): void {
    const pastedText = event.clipboardData?.getData('text') || '';
    if (!pastedText) return;

    const formatter = this.nzFormatter();
    const mask = this.nzMask();
    const length = this.nzLength();
    const newValue = [...this.internalValue()];
    let currentIndex = index;

    for (const char of pastedText.split('')) {
      if (currentIndex < length) {
        newValue[currentIndex] = char;
        const maskedValue = mask ? mask : formatter(char);
        this.otpArray.at(currentIndex).setValue(maskedValue, { emitEvent: false });
        currentIndex++;
      } else {
        break;
      }
    }

    this.internalValue.set(newValue);
    event.preventDefault(); // this line is needed, otherwise the last index that is going to be selected will also be filled (in the next line).
    this.selectInputBox(currentIndex);
    this.emitValue();
  }

  private createFormArray(): void {
    const length = this.nzLength();
    this.otpArray = this.formBuilder.array<FormControl<string>>([]);
    this.internalValue.set(new Array(length).fill(''));

    for (let i = 0; i < length; i++) {
      const control = this.formBuilder.nonNullable.control('', [Validators.required]);

      control.valueChanges
        .pipe(
          tap(value => {
            const unmaskedValue = this.nzFormatter()(value);
            this.internalValue.update(v => {
              const copy = [...v];
              copy[i] = unmaskedValue;
              return copy;
            });

            control.setValue(this.nzMask() ?? unmaskedValue, { emitEvent: false });

            this.emitValue();
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe();

      this.otpArray.push(control);
    }
  }

  private emitValue(): void {
    const result = this.internalValue().join('');
    if (this.onChangeCallback) {
      this.onChangeCallback(result);
    }
  }

  private selectInputBox(index: number): void {
    const otpInputArray = this.otpInputs();
    if (index <= 0) index = 0;
    if (index >= otpInputArray.length) index = otpInputArray.length - 1;

    otpInputArray[index].nativeElement.select();
  }
}
