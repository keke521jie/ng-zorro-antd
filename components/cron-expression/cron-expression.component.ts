/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  Injector,
  input,
  OnInit,
  signal,
  TemplateRef,
  untracked,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  ControlValueAccessor,
  FormBuilder,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  ValidatorFn,
  Validators
} from '@angular/forms';

import { CronExpressionParser } from 'cron-parser';

import { NzSafeAny } from 'ng-zorro-antd/core/types';
import { NzCronExpressionI18nInterface, NzI18nService } from 'ng-zorro-antd/i18n';

import { NzCronExpressionInputComponent } from './cron-expression-input.component';
import { NzCronExpressionLabelComponent } from './cron-expression-label.component';
import { NzCronExpressionPreviewComponent } from './cron-expression-preview.component';
import { Cron, CronChangeType, NzCronExpressionSize, NzCronExpressionType, TimeType } from './typings';

function labelsOfType(type: NzCronExpressionType): TimeType[] {
  if (type === 'spring') {
    return ['second', 'minute', 'hour', 'day', 'month', 'week'];
  }
  return ['minute', 'hour', 'day', 'month', 'week'];
}

const defaultCron: Cron = { second: '0', minute: '*', hour: '*', day: '*', month: '*', week: '*' };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  selector: 'nz-cron-expression',
  exportAs: 'nzCronExpression',
  template: `
    <div class="ant-cron-expression">
      <div class="ant-cron-expression-content">
        <div
          class="ant-input ant-cron-expression-input-group"
          [class.ant-input-lg]="nzSize() === 'large'"
          [class.ant-input-sm]="nzSize() === 'small'"
          [class.ant-input-borderless]="nzBorderless()"
          [class.ant-cron-expression-input-group-focus]="focus() && !nzBorderless()"
          [class.ant-input-status-error]="form.invalid && !nzBorderless()"
          [class.ant-cron-expression-input-group-error-focus]="form.invalid && focus() && !nzBorderless()"
          [class.ant-input-disabled]="finalDisabled()"
        >
          @for (label of labels(); track label) {
            <nz-cron-expression-input
              [value]="cronValue()[label] ?? ''"
              [label]="label"
              [disabled]="finalDisabled()"
              (focusEffect)="focusEffect($event)"
              (blurEffect)="blurEffect()"
              (getValue)="getValue($event)"
            />
          }
        </div>
        <div
          class="ant-cron-expression-label-group"
          [class.ant-input-lg]="nzSize() === 'large'"
          [class.ant-cron-expression-label-group-default]="nzSize() === 'default'"
          [class.ant-input-sm]="nzSize() === 'small'"
        >
          @for (label of labels(); track label) {
            <nz-cron-expression-label [type]="label" [labelFocus]="labelFocus()" [locale]="locale()" />
          }
        </div>
        @if (!nzCollapseDisable()) {
          <nz-cron-expression-preview
            [TimeList]="nextTimeList()"
            [visible]="form.valid"
            [locale]="locale()"
            [nzSemantic]="nzSemantic()"
            (loadMorePreview)="loadMorePreview()"
          />
        }
      </div>
      @if (nzExtra()) {
        <div class="ant-cron-expression-map">
          <ng-template [ngTemplateOutlet]="nzExtra()" />
        </div>
      }
    </div>
  `,
  providers: [
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NzCronExpressionComponent),
      multi: true
    },
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NzCronExpressionComponent),
      multi: true
    }
  ],
  imports: [
    NzCronExpressionInputComponent,
    NzCronExpressionLabelComponent,
    NzCronExpressionPreviewComponent,
    NgTemplateOutlet
  ]
})
export class NzCronExpressionComponent implements OnInit, ControlValueAccessor, Validator {
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18n = inject(NzI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly nzSize = input<NzCronExpressionSize>('default');
  readonly nzType = input<NzCronExpressionType>('linux');
  readonly nzCollapseDisable = input(false, { transform: booleanAttribute });
  readonly nzExtra = input<TemplateRef<void> | null>(null);
  readonly nzSemantic = input<TemplateRef<void> | null>(null);
  readonly nzBorderless = input(false, { transform: booleanAttribute });
  readonly nzDisabled = input(false, { transform: booleanAttribute });

  private readonly _controlDisabled = signal(false);
  readonly finalDisabled = computed(() => this.nzDisabled() || this._controlDisabled());

  readonly locale = signal<NzCronExpressionI18nInterface>({} as NzCronExpressionI18nInterface);
  readonly focus = signal(false);
  readonly labelFocus = signal<TimeType | null>(null);
  readonly labels = computed(() => labelsOfType(this.nzType()));
  readonly nextTimeList = signal<Date[]>([]);
  readonly cronValue = signal<Cron>({ ...defaultCron });

  protected readonly cronValidatorFn: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    if (control.value) {
      try {
        const cron = this.labels()
          .map(label => control.value[label])
          .join(' ');
        CronExpressionParser.parse(cron);
      } catch {
        return { error: true };
      }
    }
    return null;
  };

  protected readonly form = this.formBuilder.nonNullable.group(
    {
      second: ['0', Validators.required],
      minute: ['*', Validators.required],
      hour: ['*', Validators.required],
      day: ['*', Validators.required],
      month: ['*', Validators.required],
      week: ['*', Validators.required]
    },
    { validators: this.cronValidatorFn }
  );

  onChange: NzSafeAny = () => {};
  onTouch: () => void = () => null;

  private convertFormat(value: string): void {
    const values = value.split(' ');
    const valueObject = this.labels().reduce((obj, label, idx) => {
      obj[label] = values[idx];
      return obj;
    }, {} as Cron);
    this.cronValue.set(valueObject);
    this.form.patchValue(valueObject, { emitEvent: false });
  }

  writeValue(value: string | null): void {
    if (value) {
      this.convertFormat(value);
    }
  }

  registerOnChange(fn: NzSafeAny): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: NzSafeAny): void {
    this.onTouch = fn;
  }

  validate(): ValidationErrors | null {
    return this.form.valid ? null : { error: true };
  }

  setDisabledState(isDisabled: boolean): void {
    this._controlDisabled.set(isDisabled);
  }

  ngOnInit(): void {
    this.locale.set(this.i18n.getLocaleData('CronExpression'));
    this.i18n.localeChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.locale.set(this.i18n.getLocaleData('CronExpression'));
    });

    this.cronFormType();
    // React to subsequent nzType changes (replaces ngOnChanges)
    effect(
      () => {
        this.nzType();
        untracked(() => this.cronFormType());
      },
      { injector: this.injector }
    );

    this.previewDate(this.form.value);

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => {
      this.cronValue.set(value as Cron);
      this.onChange(Object.values(value).join(' '));
      this.previewDate(value);
    });
  }

  private cronFormType(): void {
    if (this.nzType() === 'spring') {
      this.form.controls.second.enable();
    } else {
      this.form.controls.second.disable();
    }
  }

  previewDate(value: Cron): void {
    try {
      this.interval = CronExpressionParser.parse(Object.values(value).join(' '));
      this.nextTimeList.set([
        this.interval.next().toDate(),
        this.interval.next().toDate(),
        this.interval.next().toDate(),
        this.interval.next().toDate(),
        this.interval.next().toDate()
      ]);
    } catch {
      return;
    }
  }

  loadMorePreview(): void {
    this.nextTimeList.update(list => [
      ...list,
      this.interval.next().toDate(),
      this.interval.next().toDate(),
      this.interval.next().toDate(),
      this.interval.next().toDate(),
      this.interval.next().toDate()
    ]);
  }

  focusEffect(value: TimeType): void {
    this.focus.set(true);
    this.labelFocus.set(value);
  }

  blurEffect(): void {
    this.focus.set(false);
    this.labelFocus.set(null);
  }

  getValue(item: CronChangeType): void {
    this.form.controls[item.label].patchValue(item.value);
  }

  interval!: ReturnType<typeof CronExpressionParser.parse>;
}
