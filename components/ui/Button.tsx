import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-reui-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-reui-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-reui-primary text-reui-primary-foreground hover:bg-reui-primary/90',
        destructive:
          'bg-reui-destructive text-reui-destructive-foreground hover:bg-reui-destructive/90',
        outline:
          'border border-reui-input bg-reui-background hover:bg-reui-accent hover:text-reui-accent-foreground',
        secondary:
          'bg-reui-secondary text-reui-secondary-foreground hover:bg-reui-secondary/80',
        ghost: 'hover:bg-reui-accent hover:text-reui-accent-foreground',
        link: 'text-reui-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Fix: Changed ButtonProps from an interface to a type alias to fix type inference issues with VariantProps.
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
