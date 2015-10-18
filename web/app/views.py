from flask import request, url_for, render_template, g, session, redirect, \
        flash
from flask.ext.login import login_required, login_user, logout_user, \
        current_user
from . import app, db, lm, forms
from .models import User

@lm.user_loader
def load_user(userid):
    try:
        return User.query.get(int(userid))
    except (TypeError, ValueError):
        pass

@app.before_request
def before_request():
    # so that we can access the current user wherever
    g.user = current_user

@app.route('/', methods=['GET', 'POST'])
def index():
    login_form = forms.Login()

    if login_form.validate_on_submit():
        login_user(login_form.user)
        return redirect(url_for("index"))

    return render_template("index.html",
            title="index",
            login_form=login_form)

@app.route('/about')
def about():
    return render_template("about.html", title="About Lensing Wikipedia")


@app.route("/register", methods=["GET", "POST"])
def register():
    if g.user is not None and g.user.is_authenticated():
        return redirect(url_for("index"))

    form = forms.Register()

    if form.validate_on_submit():
        user = User(email=form.email.data,
                    password=form.password.data)

        db.session.add(user)
        db.session.commit()

        flash("Registered!")

        login_user(user)
        return redirect(url_for("index"))

    return render_template("register.html",
            title="register in",
            form=form)

@app.route("/logout")
def logout():
    logout_user()
    flash("You were logged out")
    return redirect(url_for("index"))
