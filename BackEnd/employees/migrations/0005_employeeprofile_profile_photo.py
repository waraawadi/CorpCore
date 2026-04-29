from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0004_payroll_gross_salary_payrollrule_payrollcomponent"),
    ]

    operations = [
        migrations.AddField(
            model_name="employeeprofile",
            name="profile_photo",
            field=models.ImageField(blank=True, null=True, upload_to="employees/profile_photos/"),
        ),
    ]

