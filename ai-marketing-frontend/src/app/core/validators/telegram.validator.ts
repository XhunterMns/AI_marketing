import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function telegramRequiredValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const enabled = group.get('telegramEnabled')?.value;
    const token = group.get('telegramBotToken')?.value?.trim();
    const channelId = group.get('telegramChannelId')?.value?.trim();

    if (!enabled) return null;

    const errors: ValidationErrors = {};
    if (!token) errors['telegramTokenRequired'] = true;
    if (!channelId) errors['telegramChannelRequired'] = true;

    return Object.keys(errors).length ? errors : null;
  };
}
